import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {defaultRequirements} from "@/lib/audit-report";
import {buildDialogueView,dialogueInput,MAX_TURNS,MAX_TRANSCRIPT,transcript} from "@/lib/procedure-dialogue";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
async function context(id:string){
 const audit=await prisma.audit.findUnique({where:{id},select:{id:true,title:true,revision:true,status:true,client:{select:{name:true}},
  templateSnapshot:true,record:{select:{content:true}},dialogue:{include:{turns:{orderBy:{sequence:"asc"},take:MAX_TURNS}}}}});
 if(!audit)return null;
 const snapshot=audit.templateSnapshot as {criteria?:Array<{code:string;text:string}>}|null;
 const requirements=Array.isArray(snapshot?.criteria)?snapshot.criteria:defaultRequirements.map(r=>({...r}));
 const saved=(audit.record?.content??{}) as {answers?:Record<string,{answer?:string}>};
 return {audit,requirements:requirements.filter(r=>typeof r.code==="string"&&typeof r.text==="string").slice(0,100),saved:saved.answers??{}};
}
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;const found=await context(id);
 if(!found)return NextResponse.json({error:"Audit not found"},{status:404,headers});
 const {audit,requirements,saved}=found;
 const turns=audit.dialogue?.turns??[];
 return NextResponse.json({audit:{id:audit.id,title:audit.title,client:audit.client.name,status:audit.status,
  revision:audit.revision,dialogueRevision:audit.dialogue?.revision??0},
  turns,limits:{maxTurns:MAX_TURNS,maxCharacters:MAX_TRANSCRIPT},...buildDialogueView(turns,requirements,saved)},{headers});
}
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const parsed=dialogueInput.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid procedure turn",issues:parsed.error.flatten()},{status:400,headers});
 const v=parsed.data;
 const found=await context(id);if(!found)return NextResponse.json({error:"Audit not found"},{status:404,headers});
 if(found.audit.status==="COMPLETED")return NextResponse.json({error:"Completed audits cannot accept additional notes"},{status:409,headers});
 if(v.requirementCode&&!found.requirements.some(r=>r.code===v.requirementCode))
  return NextResponse.json({error:"Follow-up refers to a requirement outside this audit"},{status:400,headers});
 const actor=(await getSession(request))!.username;
 try{
  const saved=await prisma.$transaction(async tx=>{
   // Align conversational work with the same audit revision and review basis
   // as all other audit mutations. Failed writes roll back the claim.
   const locked=await tx.audit.updateMany({where:{id,revision:v.expectedRevision,status:{not:"COMPLETED"}},data:{revision:{increment:1}}});
   if(locked.count!==1)throw Error("STALE_DIALOGUE");
   const dialogue=await tx.procedureDialogue.upsert({where:{auditId:id},
    create:{auditId:id,revision:0},update:{}});
   const count=await tx.procedureDialogueTurn.count({where:{dialogueId:dialogue.id}});
   if(count>=MAX_TURNS)throw Error("DIALOGUE_LIMIT");
   const prior=await tx.procedureDialogueTurn.findMany({where:{dialogueId:dialogue.id},select:{text:true},orderBy:{sequence:"asc"}});
   if(transcript([...prior,{text:v.text}]).length>MAX_TRANSCRIPT)throw Error("DIALOGUE_LIMIT");
   const turn=await tx.procedureDialogueTurn.create({data:{dialogueId:dialogue.id,
    sequence:count+1,kind:v.kind,requirementCode:v.requirementCode,text:v.text,author:actor}});
   await tx.procedureDialogue.update({where:{id:dialogue.id},data:{revision:{increment:1}}});
   await tx.auditEvent.create({data:{auditId:id,actor,action:"PROCEDURE_DIALOGUE_TURN_ADDED",
    details:{turnId:turn.id,sequence:turn.sequence,kind:turn.kind,requirementCode:turn.requirementCode,
     // Full narrative remains in local turn table; event stores IDs only.
     auditRevision:v.expectedRevision+1}}});
   return {turnId:turn.id,revision:v.expectedRevision+1,sequence:turn.sequence};
  });
  return NextResponse.json({ok:true,...saved},{status:201,headers});
 }catch(error){
  if(error instanceof Error&&error.message==="STALE_DIALOGUE")
   return NextResponse.json({error:"Audit changed while you were composing. Refresh to review the latest conversation."},{status:409,headers});
  if(error instanceof Error&&error.message==="DIALOGUE_LIMIT")
   return NextResponse.json({error:"This conversation reached the 30-turn or 16,000-character limit. Review and apply the transcript before continuing."},{status:409,headers});
  throw error;
 }
}
