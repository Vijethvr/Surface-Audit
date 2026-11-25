import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {requireLocalPrototype} from "@/lib/dev-api";
import {readReport,reportDigest} from "@/lib/report-snapshot";
import {evidenceDigest} from "@/lib/evidence-vault";
export const runtime="nodejs";export const dynamic="force-dynamic";
const MAX_DOSSIER_BYTES=12*1024*1024;
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const result=await readReport(id);
 if(!result)return NextResponse.json({error:"Audit not found"},{status:404});
 if("error" in result)return NextResponse.json({error:result.error},{status:result.status});
 if(result.integrity.snapshot&&!result.integrity.verified)return NextResponse.json({error:"Stored report digest mismatch; export blocked"},{status:409});
 if(!result.report)return NextResponse.json({error:"No report available"},{status:409});
 const assets=await prisma.evidenceAsset.findMany({where:{auditId:id},orderBy:{createdAt:"asc"}});
 const total=assets.reduce((sum,file)=>sum+file.sizeBytes,0);
 if(total>MAX_DOSSIER_BYTES)return NextResponse.json({error:"Dossier exceeds 12 MiB limit; download evidence files individually"},{status:413});
 const files=[] as Array<{id:string;filename:string;requirementCode:string;mimeType:string;sizeBytes:number;sha256:string;base64:string}>;
 for(const file of assets){
  const bytes=Buffer.from(file.bytes);
  if(bytes.length!==file.sizeBytes||evidenceDigest(bytes)!==file.sha256)
   return NextResponse.json({error:"Evidence file checksum mismatch; export blocked",assetId:file.id},{status:409});
  files.push({id:file.id,filename:file.filename,requirementCode:file.requirementCode,mimeType:file.mimeType,
   sizeBytes:bytes.length,sha256:file.sha256,base64:bytes.toString("base64")});
 }
 const report=result.report;
 const dossier={formatVersion:"surface-audit-dossier-v1",warning:"DEVELOPMENT COPY — NOT INDEPENDENTLY APPROVED OR TAMPER-PROOF",
  generatedAt:new Date().toISOString(),auditId:id,report,reportSha256:reportDigest(report),
  reportIntegrity:result.integrity,assets:files};
 return new Response(JSON.stringify(dossier,null,2),{headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Content-Disposition":'attachment; filename="surface-audit-dossier-'+id.replace(/[^a-zA-Z0-9_-]/g,"")+'.json"',
  "Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff"
 }});
}
