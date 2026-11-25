import {createHash} from "node:crypto";
import {prisma} from "@/lib/db";
import {buildAuditReport} from "@/lib/audit-report";
function ordered(value:unknown):unknown{
 if(Array.isArray(value))return value.map(ordered);
 if(value!==null&&typeof value==="object"){
  const obj=value as Record<string,unknown>;
  return Object.fromEntries(Object.keys(obj).sort().map(key=>[key,ordered(obj[key])]));
 }
 return value;
}
export function canonicalReport(value:unknown){return JSON.stringify(ordered(value))}
export function reportDigest(value:unknown){return createHash("sha256").update(canonicalReport(value)).digest("hex")}
export async function readReport(auditId:string){
 const audit=await prisma.audit.findUnique({where:{id:auditId},select:{status:true,reportSnapshot:true}});
 if(!audit)return null;
 if(audit.reportSnapshot){
  const snap=audit.reportSnapshot;
  const valid=reportDigest(snap.report)===snap.sha256;
  return {report:snap.report,integrity:{snapshot:true,sha256:snap.sha256,verified:valid,capturedAt:snap.createdAt.toISOString()}};
 }
 if(audit.status==="COMPLETED")return {error:"Completed audit has no sealed report snapshot",status:409};
 const report=await buildAuditReport(auditId);
 return {report,integrity:{snapshot:false,verified:false,sha256:null,capturedAt:null}};
}
