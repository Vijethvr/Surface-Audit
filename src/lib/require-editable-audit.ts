import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
export async function requireEditableAudit(id:string){
 const audit=await prisma.audit.findUnique({where:{id},select:{status:true}});
 if(!audit)return NextResponse.json({error:"Audit not found"},{status:404});
 if(audit.status==="COMPLETED")return NextResponse.json({error:"Completed audit is sealed against changes"},{status:409});
 return null;
}
