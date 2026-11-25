import {requireEditableAudit} from "@/lib/require-editable-audit";
import {NextResponse} from "next/server";
import {z} from "zod";import {prisma} from "@/lib/db";import {requireLocalPrototype} from "@/lib/dev-api";
export const runtime="nodejs";
const input=z.object({status:z.enum(["OPEN","ACTION_IN_PROGRESS","READY_FOR_VERIFICATION","CLOSED"])});
export async function PATCH(request:Request,ctx:{params:Promise<{id:string;findingId:string}>}){
 const denied=requireLocalPrototype(request);if(denied)return denied;
 const {id,findingId}=await ctx.params;const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid finding status"},{status:400});
 const sealed=await requireEditableAudit(id);if(sealed)return sealed;
 const existing=await prisma.finding.findFirst({where:{id:findingId,auditId:id},include:{actions:true}});
 if(!existing)return NextResponse.json({error:"Finding not found"},{status:404});
 if(parsed.data.status==="CLOSED"&&(!existing.actions.length||existing.actions.some(x=>x.status!=="VERIFIED")))
 return NextResponse.json({error:"Closure requires all corrective actions verified"},{status:409});
 const finding=await prisma.$transaction(async tx=>{
  const item=await tx.finding.update({where:{id:findingId},data:{status:parsed.data.status}});
  await tx.auditEvent.create({data:{auditId:id,actor:process.env.SURFACE_AUDIT_ADMIN_USERNAME!,action:"FINDING_STATUS_CHANGED",details:{findingId,status:item.status}}});return item;
 });
 return NextResponse.json({finding});
}