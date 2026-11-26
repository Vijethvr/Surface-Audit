import {NextResponse} from "next/server";
import {requireLocalPrototype} from "@/lib/dev-api";
import {loadManagementReview} from "@/lib/management-review";
export const runtime="nodejs";export const dynamic="force-dynamic";

export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const url=new URL(request.url);
 const raw=url.searchParams.get("client");
 if(raw!==null&&(raw.length>160||raw.trim()!==raw))
  return NextResponse.json({error:"Invalid client filter"},{status:400});
 const report=await loadManagementReview(raw||undefined);
 if(!report)return NextResponse.json({error:"Unknown client filter"},{status:404});
 return NextResponse.json(report,{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
