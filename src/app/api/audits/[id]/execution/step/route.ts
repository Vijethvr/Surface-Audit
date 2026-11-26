import {NextResponse} from "next/server";
import {z} from "zod";
import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {requirementCodes} from "@/lib/audit-requirements";
export const runtime="nodejs";
const answer=z.enum(["Not assessed","Conforms","Nonconformity","Not applicable"]);
const finding=z.object({title:z.string().trim().min(2).max(200),description:z.string().trim().min(2).max(4000),
 severity:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"])}).strict();
const action=z.object({description:z.string().trim().min(3).max(2000),owner:z.string().trim().min(2).max(160),
 dueDate:z.string().date().nullable()}).strict();
const evidence=z.object({reference:z.string().trim().min(2).max(500),description:z.string().trim().max(1000)}).strict();
const input=z.object({expectedRevision:z.number().int().nonnegative(),requirementCode:z.string().min(1).max(30),
 answer,comment:z.string().max(4000),reference:z.string().max(500),
 finding:finding.nullable().default(null),action:action.nullable().default(null),
 evidence:evidence.nullable().default(null)}).strict().superRefine((v,ctx)=>{
 if(v.action&&!v.finding)ctx.addIssue({code:"custom",path:["action"],message:"A new action must accompany a new finding"});
 if(v.finding&&v.answer!=="Nonconformity")ctx.addIssue({code:"custom",path:["finding"],message:"New findings require a nonconformity assessment"});
 if(v.answer!=="Not assessed"&&!v.comment.trim()&&!v.reference.trim()&&!v.evidence)
  ctx.addIssue({code:"custom",path:["comment"],message:"Add an observation or a reference supporting the assessment"});
 if(v.answer==="Not assessed"&&(v.finding||v.evidence||v.action))
  ctx.addIssue({code:"custom",path:["answer"],message:"Do not attach assurance records to unassessed requirements"});
});
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid guided assessment",issues:parsed.error.flatten()},{status:400,headers});
 const v=parsed.data;
 const codes=await requirementCodes(id);
 if(!codes)return NextResponse.json({error:"Audit not found"},{status:404,headers});
 if(!codes.has(v.requirementCode))return NextResponse.json({error:"Requirement is not part of this audit"},{status:400,headers});
 const actor=(await getSession(request))!.username;
 try{
  const result=await prisma.$transaction(async tx=>{
   // Single revision-aware row lock covers assessment, evidence, findings and
   // action creation. A stale tab cannot overwrite another operator's work.
   const updated=await tx.audit.updateMany({where:{id,revision:v.expectedRevision,status:{not:"COMPLETED"}},
    data:{revision:{increment:1}}});
   if(updated.count!==1)throw Error("GUIDED_AUDIT_CONFLICT");
   const current=await tx.auditRecord.findUnique({where:{auditId:id}});
   const raw=(current?.content??{}) as {answers?:Record<string,{answer:string;comment:string;reference:string}>;
    summary?:string;reviewer?:string};
   const existing=raw.answers??{};
   if(v.answer==="Nonconformity"&&!v.finding){
    const count=await tx.finding.count({where:{auditId:id,requirementCode:v.requirementCode}});
    if(!count)throw Error("GUIDED_FINDING_REQUIRED");
   }
   // Existing author summary and other requirement responses stay intact.
   const next={answers:{...existing,[v.requirementCode]:{answer:v.answer,comment:v.comment,reference:v.reference}},
    summary:raw.summary??"",reviewer:raw.reviewer??""};
   await tx.auditRecord.upsert({where:{auditId:id},create:{auditId:id,content:next as Prisma.InputJsonValue,preparedBy:actor},
    update:{content:next as Prisma.InputJsonValue,preparedBy:actor}});
   const newEvidence=v.evidence?await tx.evidenceReference.create({data:{auditId:id,requirementCode:v.requirementCode,
    reference:v.evidence.reference,description:v.evidence.description}}):null;
   const newFinding=v.finding?await tx.finding.create({data:{auditId:id,requirementCode:v.requirementCode,...v.finding}}):null;
   const newAction=v.action&&newFinding?await tx.correctiveAction.create({data:{findingId:newFinding.id,
    description:v.action.description,owner:v.action.owner,
    dueDate:v.action.dueDate?new Date(v.action.dueDate+"T00:00:00Z"):null}}):null;
   await tx.auditEvent.create({data:{auditId:id,actor,action:"GUIDED_REQUIREMENT_ASSESSED",
    details:{requirementCode:v.requirementCode,answer:v.answer,revision:v.expectedRevision+1,
     evidenceId:newEvidence?.id??null,findingId:newFinding?.id??null,actionId:newAction?.id??null}}});
   return {revision:v.expectedRevision+1,requirementCode:v.requirementCode,
    evidenceId:newEvidence?.id??null,findingId:newFinding?.id??null,actionId:newAction?.id??null};
  });
  return NextResponse.json({ok:true,...result},{headers});
 }catch(error){
  if(error instanceof Error&&error.message==="GUIDED_AUDIT_CONFLICT")
   return NextResponse.json({error:"Audit changed or was completed while editing. Reload before resubmitting."},{status:409,headers});
  if(error instanceof Error&&error.message==="GUIDED_FINDING_REQUIRED")
   return NextResponse.json({error:"Nonconformity needs an existing finding or a new structured finding"},{status:409,headers});
  throw error;
 }
}
