import {NextResponse} from "next/server";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {incidentCsv,loadIncidentReview,parseIncidentQuery} from "@/lib/security-incident-review";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer"};
export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const session=await getSession(request);
 if(session?.role!=="ADMIN")return NextResponse.json({error:"Administrator access required"},{status:403,headers});
 const url=new URL(request.url);
 const format=url.searchParams.get("format")??"json";
 if(!["json","csv"].includes(format))
  return NextResponse.json({error:"format must be json or csv"},{status:400,headers});
 let query:ReturnType<typeof parseIncidentQuery>;
 try{query=parseIncidentQuery(url)}catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Invalid filters"},{status:400,headers});
 }
 const report=await loadIncidentReview(query);
 if(format==="csv")return new NextResponse(incidentCsv(report),{headers:{
  ...headers,"Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":'attachment; filename="surface-audit-security-incidents.csv"'
 }});
 return NextResponse.json(report,{headers});
}
