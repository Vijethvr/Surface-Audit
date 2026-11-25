import {guardedAuditTransaction} from "@/lib/audit-mutation";
import {getSession} from "@/lib/local-auth";
import {requireEditableAudit} from "@/lib/require-editable-audit";
import {NextResponse} from "next/server";
import {z} from "zod";import {prisma} from "@/lib/db";import {requireLocalPrototype} from "@/lib/dev-api";
export const runtime="nodejs";
const input=z.object({status:z.enum(["OPEN","IN_PROGRESS","COMPLETED","VERIFIED"]),closureEvidence:z.string().trim().max(500).optional(),verifiedBy:z.string().trim().max(160).optional()});
export async function PATCH(request:Request,ctx:{params:Promise<{id:string;findingId:string;actionId:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id,findingId,actionId}=await ctx.params;const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid action update"},{status:400});
 const sealed=await requireEditableAudit(id);if(sealed)return sealed;
 const existing=await prisma.correctiveAction.findFirst({where:{id:actionId,findingId,finding:{auditId:id}},include:{finding:true}});
 if(!existing)return NextResponse.json({error:"Action not found"},{status:404});
 if(existing.finding.status==="CLOSED")return NextResponse.json({error:"Finding is closed"},{status:409});
 const evidence=parsed.data.closureEvidence??existing.closureEvidence??"";
 const verifier=parsed.data.verifiedBy??existing.verifiedBy??"";
 if(parsed.data.status==="VERIFIED"&&(!evidence.trim()||!verifier.trim()))return NextResponse.json({error:"Verifier and closure evidence required"},{status:400});
 const action=await guardedAuditTransaction(id,async tx=>{
 const item=await tx.correctiveAction.update({where:{id:actionId},data:{status:parsed.data.status,closureEvidence:evidence||null,verifiedBy:parsed.data.status==="VERIFIED"?verifier:null,verifiedAt:parsed.data.status==="VERIFIED"?new Date():null}});
 await tx.auditEvent.create({data:{auditId:id,actor:(await getSession(request))!.username,action:"CAPA_STATUS_CHANGED",details:{findingId,actionId,status:item.status,reference:item.closureEvidence}}});return item;
 });
 return NextResponse.json({action});
}