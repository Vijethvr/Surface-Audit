import {NextResponse} from "next/server";
import {requireLocalPrototype} from "@/lib/dev-api";
import {buildAuditReport} from "@/lib/audit-report";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const report=await buildAuditReport(id);
 if(!report)return NextResponse.json({error:"Audit not found"},{status:404});
 return NextResponse.json({report},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
