import {auditMutationConflict} from "@/lib/audit-mutation";
import {guardedAuditTransaction} from "@/lib/audit-mutation";
import {getSession} from "@/lib/local-auth";
import {requireEditableAudit} from "@/lib/require-editable-audit";
import {NextResponse} from "next/server";
import {z} from "zod";import {prisma} from "@/lib/db";import {requireLocalPrototype} from "@/lib/dev-api";
export const runtime="nodejs";
const input=z.object({description:z.string().trim().min(3).max(2000),owner:z.string().trim().min(2).max(160),dueDate:z.string().date().nullable().optional()});
export async function POST(request:Request,ctx:{params:Promise<{id:string;findingId:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id,findingId}=await ctx.params;const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid corrective action"},{status:400});
 const sealed=await requireEditableAudit(id);if(sealed)return sealed;
 const finding=await prisma.finding.findFirst({where:{id:findingId,auditId:id}});
 if(!finding)return NextResponse.json({error:"Finding not found"},{status:404});
 if(finding.status==="CLOSED")return NextResponse.json({error:"Cannot change closed finding"},{status:409});
 let action;try{action=await guardedAuditTransaction(id,async tx=>{
 const item=await tx.correctiveAction.create({data:{findingId,description:parsed.data.description,owner:parsed.data.owner,dueDate:parsed.data.dueDate?new Date(parsed.data.dueDate+"T00:00:00Z"):null}});
 await tx.auditEvent.create({data:{auditId:id,actor:(await getSession(request))!.username,action:"CAPA_CREATED",details:{findingId,actionId:item.id,owner:item.owner}}});return item;
 }); }catch(error){
  if(auditMutationConflict(error))return NextResponse.json({error:"Audit has been sealed; reload before changing records"},{status:409});
  throw error;
 }
 
 return NextResponse.json({action},{status:201});
}