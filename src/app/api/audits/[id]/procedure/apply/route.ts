import {NextResponse} from "next/server";
import {z} from "zod";
import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {requirementCodes} from "@/lib/audit-requirements";
import {digestProcedure} from "@/lib/procedure-intelligence";
export const runtime="nodejs";export const dynamic="force-dynamic";
const schema=z.object({
 expectedRevision:z.number().int().nonnegative(),
 procedure:z.string().trim().min(40).max(16000),
 procedureSha256:z.string().regex(/^[a-f0-9]{64}$/),
 entries:z.array(z.object({
  code:z.string().min(1).max(30),excerpt:z.string().min(5).max(1500),
  answer:z.enum(["Not assessed","Conforms","Nonconformity","Not applicable"]),
  comment:z.string().trim().min(5).max(4000),
  reference:z.string().max(500)
 }).strict()).min(1).max(100)
}).strict().superRefine((v,ctx)=>{
 if(new Set(v.entries.map(e=>e.code)).size!==v.entries.length)ctx.addIssue({code:"custom",path:["entries"],message:"Requirement entries must be unique"});
 if(v.procedureSha256!==digestProcedure(v.procedure))ctx.addIssue({code:"custom",path:["procedureSha256"],message:"Procedure changed; analyze it again"});
 for(const [index,e] of v.entries.entries()){
  if(!v.procedure.includes(e.excerpt))ctx.addIssue({code:"custom",path:["entries",index,"excerpt"],message:"Supporting quote must occur in the procedure"});
  if(e.answer==="Nonconformity")ctx.addIssue({code:"custom",path:["entries",index,"answer"],message:"Use guided execution to create a structured finding before recording a nonconformity"});
 }
});
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid reviewed procedure mapping",issues:parsed.error.flatten()},{status:400,headers});
 const v=parsed.data;
 const allowed=await requirementCodes(id);
 if(!allowed)return NextResponse.json({error:"Audit not found"},{status:404,headers});
 if(v.entries.some(e=>!allowed.has(e.code)))return NextResponse.json({error:"Proposal contains a requirement outside this audit"},{status:400,headers});
 const actor=(await getSession(request))!.username;
 try{
  const saved=await prisma.$transaction(async tx=>{
   const claimed=await tx.audit.updateMany({where:{id,revision:v.expectedRevision,status:{not:"COMPLETED"}},
    data:{revision:{increment:1}}});
   if(claimed.count!==1)throw Error("STALE_PROCEDURE");
   const prior=await tx.auditRecord.findUnique({where:{auditId:id}});
   const raw=(prior?.content??{}) as {answers?:Record<string,{answer?:string;comment?:string;reference?:string}>;summary?:string;reviewer?:string};
   const answers={...(raw.answers??{})};
   for(const entry of v.entries){
    if(Object.prototype.hasOwnProperty.call(answers,entry.code))
     throw Error("EXISTING_ASSESSMENT");
    answers[entry.code]={answer:entry.answer,comment:entry.comment,reference:entry.reference};
   }
   const content={answers,summary:raw.summary??"",reviewer:raw.reviewer??""};
   await tx.auditRecord.upsert({where:{auditId:id},create:{auditId:id,preparedBy:actor,content:content as Prisma.InputJsonValue},
    update:{content:content as Prisma.InputJsonValue,preparedBy:actor}});
   await tx.auditEvent.create({data:{auditId:id,actor,action:"PROCEDURE_MAPPING_APPLIED",
    details:{procedureSha256:v.procedureSha256,requirementCodes:v.entries.map(e=>e.code),
     reviewDecisions:v.entries.map(e=>({code:e.code,answer:e.answer,excerpt:e.excerpt})),revision:v.expectedRevision+1}}});
   return {revision:v.expectedRevision+1,count:v.entries.length};
  });
  return NextResponse.json({ok:true,...saved},{headers});
 }catch(error){
  if(error instanceof Error&&error.message==="STALE_PROCEDURE")
   return NextResponse.json({error:"Audit changed since analysis. Refresh and review suggestions again."},{status:409,headers});
  if(error instanceof Error&&error.message==="EXISTING_ASSESSMENT")
   return NextResponse.json({error:"An existing assessment is already recorded; the procedure assistant will not overwrite it."},{status:409,headers});
  throw error;
 }
}
