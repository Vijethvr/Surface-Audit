import {getSession} from "@/lib/local-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import type {Prisma} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";
import { buildAuditReport } from "@/lib/audit-report";
import {auditReviewState} from "@/lib/audit-review";
import {reportDigest} from "@/lib/report-snapshot";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const status=z.enum(["Scheduled","In progress","In review","Completed"]);
const answer=z.enum(["Not assessed","Conforms","Nonconformity","Not applicable"]);
const record=z.object({
  answers:z.record(z.string(),z.object({
    answer,
    comment:z.string().max(4000),
    reference:z.string().max(500)
  })).refine(obj=>Object.keys(obj).length<=100),
  summary:z.string().max(12000),
  reviewer:z.string().max(160)
});
const update=z.object({status:status.optional(),record:record.optional(),expectedRevision:z.number().int().nonnegative().optional()}).refine(x=>x.status!==undefined||x.record!==undefined);
const dbStatus={"Scheduled":"SCHEDULED","In progress":"IN_PROGRESS","In review":"IN_REVIEW","Completed":"COMPLETED"} as const;

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const denied=await requireLocalPrototype(_request);if(denied)return denied;
  const {id}=await context.params;
  try {
    const audit=await prisma.audit.findUnique({where:{id},include:{record:true,project:true,equipmentLinks:{include:{equipment:true}}}});
    if(!audit)return NextResponse.json({error:"Audit not found"},{status:404});
    return NextResponse.json({revision:audit.revision,record:audit.record?.content??{answers:{},summary:"",reviewer:""},templateSnapshot:audit.templateSnapshot,project:audit.project?{id:audit.project.id,name:audit.project.name}:null,equipment:audit.equipmentLinks.map(link=>({id:link.equipment.id,identifier:link.equipment.identifier,name:link.equipment.name,calibrationDue:link.equipment.calibrationDue}))},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Unable to load audit record."},{status:503});}
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  const denied=await requireLocalPrototype(request);if(denied)return denied;
  const {id}=await context.params;
  let payload:unknown;
  try{payload=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body"},{status:400});}
  const parsed=update.safeParse(payload);
  if(!parsed.success)return NextResponse.json({error:"Invalid update",issues:parsed.error.flatten()},{status:400});
  try{
    const exists=await prisma.audit.findUnique({where:{id},select:{id:true,revision:true,templateSnapshot:true,status:true,reportSnapshot:true}});
    if(!exists)return NextResponse.json({error:"Audit not found"},{status:404});
    if(exists.status==="COMPLETED")return NextResponse.json({error:"Completed audit is sealed and cannot be modified"},{status:409});
    if(parsed.data.expectedRevision!==undefined&&parsed.data.expectedRevision!==exists.revision)return NextResponse.json({error:"Audit changed since it was loaded. Reload and review changes before saving.",revision:exists.revision},{status:409});
    if(parsed.data.record&&exists.templateSnapshot){
      const snapshot=exists.templateSnapshot as {criteria?:Array<{code:string}>};
      const allowed=new Set((snapshot.criteria??[]).map(item=>item.code));
      if(Object.keys(parsed.data.record.answers).some(code=>!allowed.has(code)))return NextResponse.json({error:"Assessment references are not in the audit template snapshot"},{status:400});
    }
    // Prevent bypassing the closure gate by supplying a new unsaved assessment
    // and a completed status in the same request.
    let sealingReport:Prisma.InputJsonValue|null=null;
    if(parsed.data.status==="Completed"){
      if(parsed.data.record)return NextResponse.json({error:"Save the assessment separately before requesting completion"},{status:409});
      if(exists.status!=="IN_REVIEW")return NextResponse.json({error:"Audit must be In review before completion"},{status:409});
      const review=await auditReviewState(id);
      if(!review.current)return NextResponse.json({error:"A current independent approval is required before completion"},{status:409});
      const current=await buildAuditReport(id);
      if(!current)return NextResponse.json({error:"Audit not found"},{status:404});
      if(!current.readiness.ready)return NextResponse.json({error:"Audit not ready for completion",blockers:current.readiness.blockers},{status:409});
      sealingReport=JSON.parse(JSON.stringify({...current,audit:{...current.audit,status:"COMPLETED"},reportStatus:"SEALED DEVELOPMENT REPORT — NOT AN APPROVED COMPLIANCE CERTIFICATE"})) as Prisma.InputJsonValue;
    }
    await prisma.$transaction(async tx=>{
      const claimed=await tx.audit.updateMany({where:{id,revision:exists.revision,status:{not:"COMPLETED"}},data:{
        revision:{increment:1},...(parsed.data.status?{status:dbStatus[parsed.data.status]}:{})
      }});
      if(claimed.count!==1)throw new Error("STALE_AUDIT_REVISION");
      if(sealingReport)await tx.auditReportSnapshot.create({data:{auditId:id,report:sealingReport,sha256:reportDigest(sealingReport)}});
      if(parsed.data.record)await tx.auditRecord.upsert({
        where:{auditId:id},create:{auditId:id,content:parsed.data.record,preparedBy:(await getSession(request))!.username},update:{content:parsed.data.record,preparedBy:(await getSession(request))!.username}
      });
      await tx.auditEvent.create({data:{auditId:id,actor:(await getSession(request))!.username,action:parsed.data.status==="Completed"?"AUDIT_SEALED":"AUDIT_UPDATED",details:{status:parsed.data.status??null,recordUpdated:Boolean(parsed.data.record)}}});
    });
    return NextResponse.json({ok:true,revision:exists.revision+1});
  }catch(error){if(error instanceof Error&&error.message==="STALE_AUDIT_REVISION")return NextResponse.json({error:"Audit was changed concurrently. Reload before retrying."},{status:409});return NextResponse.json({error:"Unable to save audit record."},{status:500});}
}
