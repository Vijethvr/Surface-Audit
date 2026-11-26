import {NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {auditMutationConflict,guardedAuditTransaction} from "@/lib/audit-mutation";
export const runtime="nodejs";
const schema=z.object({kind:z.enum(["AUDIT","ACTION"]),id:z.string().cuid(),
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()});
export async function PATCH(request:Request){
 const denial=await requireLocalPrototype(request);if(denial)return denial;
 const body=schema.safeParse(await request.json().catch(()=>null));
 if(!body.success)return NextResponse.json({error:"Invalid scheduling change"},{status:400});
 const {kind,id,date}=body.data;
 const parsed=date?new Date(date+"T00:00:00Z"):null;
 if(parsed&&(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date))
  return NextResponse.json({error:"Invalid calendar date"},{status:400});
 const actor=(await getSession(request))!.username;
 const target=kind==="AUDIT"?await prisma.audit.findUnique({where:{id},select:{id:true,status:true}}):
  await prisma.correctiveAction.findUnique({where:{id},select:{status:true,finding:{select:{status:true,auditId:true}}}});
 if(!target)return NextResponse.json({error:"Commitment not found"},{status:404});
 const auditId=kind==="AUDIT"?id:("finding" in target?target.finding.auditId:"");
 if(kind==="ACTION"&&"finding" in target&&(target.status==="VERIFIED"||target.finding.status==="CLOSED"))
  return NextResponse.json({error:"Verified or closed corrective actions cannot be rescheduled"},{status:409});
 try{
  await guardedAuditTransaction(auditId,async tx=>{
   if(kind==="AUDIT")await tx.audit.update({where:{id},data:{targetDate:parsed}});
   else await tx.correctiveAction.update({where:{id},data:{dueDate:parsed}});
   await tx.auditEvent.create({data:{auditId,actor,action:kind==="AUDIT"?"AUDIT_TARGET_RESCHEDULED":"CAPA_DUE_RESCHEDULED",
    details:{commitmentId:id,kind,targetDate:date}}});
  });
 }catch(error){
  if(auditMutationConflict(error))return NextResponse.json({error:"Audit is sealed; schedule cannot be changed"},{status:409});
  throw error;
 }
 return NextResponse.json({ok:true,id,kind,date},{headers:{"Cache-Control":"no-store"}});
}
