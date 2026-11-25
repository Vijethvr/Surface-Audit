import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {requireLocalPrototype} from "@/lib/dev-api";
import {evidenceDigest,safeFilename} from "@/lib/evidence-vault";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{id:string;assetId:string}>}){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const {id,assetId}=await ctx.params;
 const asset=await prisma.evidenceAsset.findFirst({where:{id:assetId,auditId:id}});
 if(!asset)return NextResponse.json({error:"Evidence not found"},{status:404});
 const bytes=Buffer.from(asset.bytes);
 if(evidenceDigest(bytes)!==asset.sha256||bytes.length!==asset.sizeBytes)
  return NextResponse.json({error:"Stored file integrity mismatch; download blocked"},{status:409,headers:{"Cache-Control":"no-store"}});
 return new Response(new Uint8Array(bytes),{status:200,headers:{
  "Content-Type":"application/octet-stream",
  "Content-Disposition":'attachment; filename="'+safeFilename(asset.filename)+'"',
  "Content-Length":String(bytes.length),
  "Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff",
  "Content-Security-Policy":"sandbox"
 }});
}
