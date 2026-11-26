import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {requireLocalPrototype} from "@/lib/dev-api";
import {buildAuditReport,defaultRequirements} from "@/lib/audit-report";
export const runtime="nodejs";
export const dynamic="force-dynamic";

// Bounded, authenticated projection of the authoritative assessment and
// linked assurance records. No evidence file bytes are returned.
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const audit=await prisma.audit.findUnique({where:{id},select:{
  id:true,title:true,type:true,status:true,revision:true,targetDate:true,
  client:{select:{name:true}},project:{select:{id:true,name:true}},
  templateSnapshot:true,record:{select:{content:true}},
  _count:{select:{findings:true,evidenceReferences:true,evidenceAssets:true}}
 }});
 if(!audit)return NextResponse.json({error:"Audit not found"},{status:404});
 const snapshot=audit.templateSnapshot as {title?:string;revision?:string;criteria?:Array<{code:string;text:string}>}|null;
 const requirements=Array.isArray(snapshot?.criteria)?snapshot.criteria:defaultRequirements;
 const [findings,evidence,assets,report]=await Promise.all([
  prisma.finding.findMany({where:{auditId:id},select:{id:true,requirementCode:true,title:true,severity:true,status:true,
   actions:{select:{id:true,description:true,status:true,owner:true,dueDate:true,closureEvidence:true,verifiedBy:true}}},take:250,orderBy:{createdAt:"asc"}}),
  prisma.evidenceReference.findMany({where:{auditId:id},select:{id:true,requirementCode:true,reference:true,description:true},take:500,orderBy:{createdAt:"asc"}}),
  prisma.evidenceAsset.findMany({where:{auditId:id},select:{id:true,requirementCode:true,filename:true,sizeBytes:true,sha256:true},take:100,orderBy:{createdAt:"asc"}}),
  buildAuditReport(id)
 ]);
 const raw=(audit.record?.content??{}) as {answers?:Record<string,{answer?:string;comment?:string;reference?:string}>;summary?:string;reviewer?:string};
 const answers=raw.answers??{};
 const items=requirements.map((req,index)=>{
  const response=answers[req.code]??{};
  const answer=response.answer??"Not assessed";
  const linkedFindings=findings.filter(f=>f.requirementCode===req.code);
  const linkedEvidence=evidence.filter(e=>e.requirementCode===req.code);
  const linkedAssets=assets.filter(e=>e.requirementCode===req.code);
  const reasons:string[]=[];
  if(answer==="Not assessed")reasons.push("Assessment not recorded");
  else{
   if(!(response.comment?.trim()||response.reference?.trim()))reasons.push("Observation or reference missing");
   if(answer==="Nonconformity"&&!linkedFindings.length)reasons.push("Structured finding required");
  }
  if(linkedFindings.some(f=>f.status!=="CLOSED"))reasons.push("Open finding requires follow-up");
  return {index,code:req.code,title:req.text,answer,comment:response.comment??"",
   reference:response.reference??"",findings:linkedFindings,evidence:linkedEvidence,assets:linkedAssets,
   ready:reasons.length===0,blockers:reasons};
 });
 return NextResponse.json({audit:{id:audit.id,title:audit.title,type:audit.type,status:audit.status,revision:audit.revision,
  client:audit.client.name,project:audit.project,targetDate:audit.targetDate?.toISOString().slice(0,10)??null,
  template:{title:snapshot?.title??"Demonstration checklist",revision:snapshot?.revision??"demo-v0.2"}},
  assessment:{summary:raw.summary??"",reviewer:raw.reviewer??""},
  items,counts:{total:items.length,assessed:items.filter(i=>i.answer!=="Not assessed").length,
   complete:items.filter(i=>i.ready).length,nonconforming:items.filter(i=>i.answer==="Nonconformity").length,
   findings:audit._count.findings,evidenceReferences:audit._count.evidenceReferences,evidenceFiles:audit._count.evidenceAssets},
  reportReadiness:report?.readiness??{ready:false,blockers:["Report unavailable"]},
  scope:{findingTruncated:audit._count.findings>findings.length,evidenceTruncated:audit._count.evidenceReferences>evidence.length,
   assetTruncated:audit._count.evidenceAssets>assets.length},
  notice:"Development-only assessment assistant; requirement completion and records do not establish regulatory conformance."
 },{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
