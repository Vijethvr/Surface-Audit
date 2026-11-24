import {prisma} from "@/lib/db";
const defaults=new Set(Array.from({length:8},(_,i)=>"REQ-"+String(i+1).padStart(2,"0")));
export async function requirementCodes(auditId:string):Promise<Set<string>|null>{
 const audit=await prisma.audit.findUnique({where:{id:auditId},select:{templateSnapshot:true}});
 if(!audit)return null;
 if(!audit.templateSnapshot)return defaults;
 const snapshot=audit.templateSnapshot as {criteria?:Array<{code?:unknown}>};
 return new Set((Array.isArray(snapshot.criteria)?snapshot.criteria:[]).map(x=>x.code).filter((x):x is string=>typeof x==="string"));
}