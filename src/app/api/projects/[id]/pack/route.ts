import {NextResponse} from "next/server";
import {requireLocalPrototype} from "@/lib/dev-api";
import {compileProjectPack} from "@/lib/compile-project-pack";
export const runtime="nodejs";export const dynamic="force-dynamic";

export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const url=new URL(request.url);
 const allowed=new Set(["preview","package","csv"]);
 if([...url.searchParams.keys()].some(k=>k!=="format")||url.searchParams.getAll("format").length>1)
  return NextResponse.json({error:"Unknown or duplicate export option"},{status:400});
 const format=url.searchParams.get("format")??"preview";
 if(!allowed.has(format))return NextResponse.json({error:"Unsupported project pack format"},{status:400});
 const result=await compileProjectPack(id);
 if(!result)return NextResponse.json({error:"Project not found"},{status:404});
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 if(format==="preview")return NextResponse.json({content:result.content,contentSha256:result.contentHash,
  exportReady:result.content.readiness.ready,
  note:"Live preview; not independently signed and not a client-delivered acceptance."},{headers});
 if(!result.content.readiness.ready)return NextResponse.json({
  error:"Project pack cannot be exported until internal closure gates are satisfied",
  blockers:result.content.readiness.blockers},{status:409,headers});
 if(format==="csv")return new Response(result.register,{headers:{...headers,
  "Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":'attachment; filename="surface-project-handoff.csv"'}});
 return new Response(JSON.stringify(result.portable,null,2)+"\n",{headers:{...headers,
  "Content-Type":"application/json; charset=utf-8",
  "Content-Disposition":'attachment; filename="surface-project-pack.json"'}});
}
