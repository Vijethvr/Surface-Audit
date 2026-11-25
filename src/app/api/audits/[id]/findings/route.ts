import {requireEditableAudit} from "@/lib/require-editable-audit";
import {NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {requireLocalPrototype} from "@/lib/dev-api";
import {requirementCodes} from "@/lib/audit-requirements";
export const runtime="nodejs"; export const dynamic="force-dynamic";
const input=z.object({requirementCode:z.string().min(1).max(30),title:z.string().trim().min(2).max(200),description:z.string().trim().min(2).max(4000),severity:z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]).default("MEDIUM")});
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 if(!await requirementCodes(id))return NextResponse.json({error:"Audit not found"},{status:404});
 const findings=await prisma.finding.findMany({where:{auditId:id},include:{actions:true},orderBy:{createdAt:"desc"},take:250});
 return NextResponse.json({findings},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid finding"},{status:400});
 const sealed=await requireEditableAudit(id);if(sealed)return sealed;
 const codes=await requirementCodes(id);
 if(!codes)return NextResponse.json({error:"Audit not found"},{status:404});
 if(!codes.has(parsed.data.requirementCode))return NextResponse.json({error:"Requirement not in audit"},{status:400});
 const finding=await prisma.$transaction(async tx=>{
  const item=await tx.finding.create({data:{auditId:id,...parsed.data}});
  await tx.auditEvent.create({data:{auditId:id,actor:process.env.SURFACE_AUDIT_ADMIN_USERNAME!,action:"FINDING_CREATED",details:{findingId:item.id,requirementCode:item.requirementCode,severity:item.severity}}});
  return item;
 });
 return NextResponse.json({finding},{status:201});
}