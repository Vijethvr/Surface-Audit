import type {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";

// Lock the audit row as the first statement in a mutation transaction.
// PostgreSQL row-level update serialization ensures completed audits cannot
// receive late evidence/CAPA writes and forces revision conflicts for stale saves.
export async function claimAuditMutation(tx:Prisma.TransactionClient,auditId:string){
 const result=await tx.audit.updateMany({
  where:{id:auditId,status:{not:"COMPLETED"}},
  data:{revision:{increment:1}}
 });
 if(result.count!==1)throw new Error("AUDIT_MUTATION_BLOCKED");
}
export function auditMutationConflict(error:unknown){
 return error instanceof Error&&error.message==="AUDIT_MUTATION_BLOCKED";
}

export async function guardedAuditTransaction<T>(auditId:string,callback:(tx:Prisma.TransactionClient)=>Promise<T>){
 return prisma.$transaction(async tx=>{
  await claimAuditMutation(tx,auditId);
  return callback(tx);
 });
}
