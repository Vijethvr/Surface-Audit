import {NextResponse} from "next/server";
import {requireLocalPrototype} from "@/lib/dev-api";
import {readReport} from "@/lib/report-snapshot";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const result=await readReport(id);
 if(!result)return NextResponse.json({error:"Audit not found"},{status:404});
 if("error" in result)return NextResponse.json({error:result.error},{status:result.status});
 return NextResponse.json(result,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
