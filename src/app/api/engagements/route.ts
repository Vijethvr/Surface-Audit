import {NextResponse} from "next/server";
import {z} from "zod";
import {requireLocalPrototype} from "@/lib/dev-api";
import {loadClientEngagement,loadEngagementDirectory,engagementCsv} from "@/lib/engagement-studio";
export const runtime="nodejs";export const dynamic="force-dynamic";
const filters=z.object({client:z.string().min(1).max(160).optional(),project:z.string().cuid().optional(),
 format:z.enum(["json","csv"]).default("json")}).strict();
export async function GET(request:Request){
 const denial=await requireLocalPrototype(request);if(denial)return denial;
 const url=new URL(request.url);
 const raw=Object.fromEntries(url.searchParams.entries());
 if(url.searchParams.size!==Object.keys(raw).length)return NextResponse.json({error:"Duplicate filters are not allowed"},{status:400});
 const parsed=filters.safeParse(raw);
 if(!parsed.success||parsed.data.project&&!parsed.data.client)
  return NextResponse.json({error:"Invalid engagement filters"},{status:400,headers:{"Cache-Control":"private, no-store"}});
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 if(!parsed.data.client){
  if(parsed.data.format!=="json")return NextResponse.json({error:"Choose a client before exporting"},{status:400,headers});
  return NextResponse.json({asOf:new Date().toISOString(),...await loadEngagementDirectory()},{headers});
 }
 const data=await loadClientEngagement(parsed.data.client,parsed.data.project);
 if(!data)return NextResponse.json({error:"Client or project not found"},{status:404,headers});
 if(parsed.data.format==="csv")return new Response(engagementCsv(data),{headers:{...headers,
  "Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="surface-engagement-handoff.csv"'}});
 return NextResponse.json(data,{headers});
}
