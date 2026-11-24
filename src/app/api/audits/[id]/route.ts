import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";

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
const update=z.object({status:status.optional(),record:record.optional()}).refine(x=>x.status!==undefined||x.record!==undefined);
const dbStatus={"Scheduled":"SCHEDULED","In progress":"IN_PROGRESS","In review":"IN_REVIEW","Completed":"COMPLETED"} as const;

export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const denied=requireLocalPrototype(_request);if(denied)return denied;
  const {id}=await context.params;
  try {
    const audit=await prisma.audit.findUnique({where:{id},include:{record:true,project:true,equipmentLinks:{include:{equipment:true}}}});
    if(!audit)return NextResponse.json({error:"Audit not found"},{status:404});
    return NextResponse.json({record:audit.record?.content??{answers:{},summary:"",reviewer:""},templateSnapshot:audit.templateSnapshot,project:audit.project?{id:audit.project.id,name:audit.project.name}:null,equipment:audit.equipmentLinks.map(link=>({id:link.equipment.id,identifier:link.equipment.identifier,name:link.equipment.name,calibrationDue:link.equipment.calibrationDue}))},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Unable to load audit record."},{status:503});}
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) {
  const denied=requireLocalPrototype(request);if(denied)return denied;
  const {id}=await context.params;
  let payload:unknown;
  try{payload=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body"},{status:400});}
  const parsed=update.safeParse(payload);
  if(!parsed.success)return NextResponse.json({error:"Invalid update",issues:parsed.error.flatten()},{status:400});
  try{
    const exists=await prisma.audit.findUnique({where:{id},select:{id:true,templateSnapshot:true}});
    if(!exists)return NextResponse.json({error:"Audit not found"},{status:404});
    if(parsed.data.record&&exists.templateSnapshot){
      const snapshot=exists.templateSnapshot as {criteria?:Array<{code:string}>};
      const allowed=new Set((snapshot.criteria??[]).map(item=>item.code));
      if(Object.keys(parsed.data.record.answers).some(code=>!allowed.has(code)))return NextResponse.json({error:"Assessment references are not in the audit template snapshot"},{status:400});
    }
    await prisma.$transaction(async tx=>{
      if(parsed.data.status)await tx.audit.update({where:{id},data:{status:dbStatus[parsed.data.status]}});
      if(parsed.data.record)await tx.auditRecord.upsert({
        where:{auditId:id},create:{auditId:id,content:parsed.data.record},update:{content:parsed.data.record}
      });
      await tx.auditEvent.create({data:{auditId:id,actor:process.env.SURFACE_AUDIT_ADMIN_USERNAME!,action:"AUDIT_UPDATED",details:{status:parsed.data.status??null,recordUpdated:Boolean(parsed.data.record)}}});
    });
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:"Unable to save audit record."},{status:500});}
}
