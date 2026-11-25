import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {requireLocalPrototype} from "@/lib/dev-api";
import {requireEditableAudit} from "@/lib/require-editable-audit";
import {requirementCodes} from "@/lib/audit-requirements";
import {evidenceDigest,inspectEvidence,maxEvidenceBytes,maxEvidencePerAudit,safeFilename} from "@/lib/evidence-vault";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denial=await requireLocalPrototype(request);if(denial)return denial;
 const {id}=await ctx.params;
 const codes=await requirementCodes(id);if(!codes)return NextResponse.json({error:"Audit not found"},{status:404});
 const assets=await prisma.evidenceAsset.findMany({where:{auditId:id},select:{id:true,requirementCode:true,filename:true,mimeType:true,sizeBytes:true,sha256:true,uploadedBy:true,createdAt:true},orderBy:{createdAt:"desc"},take:maxEvidencePerAudit});
 return NextResponse.json({assets,maxEvidenceBytes,maxEvidencePerAudit},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const denial=await requireLocalPrototype(request);if(denial)return denial;
 const {id}=await ctx.params;
 const sealed=await requireEditableAudit(id);if(sealed)return sealed;
 const len=Number(request.headers.get("content-length")||0);
 if(len>maxEvidenceBytes+100_000)return NextResponse.json({error:"Upload exceeds 1 MiB limit"},{status:413});
 let form:FormData;
 try{form=await request.formData()}catch{return NextResponse.json({error:"Invalid upload form"},{status:400})}
 const file=form.get("file");
 const requirementCode=form.get("requirementCode");
 if(!(file instanceof File)||typeof requirementCode!=="string")return NextResponse.json({error:"File and requirement required"},{status:400});
 if(file.size<1||file.size>maxEvidenceBytes)return NextResponse.json({error:"File must be 1 byte to 1 MiB"},{status:413});
 const codes=await requirementCodes(id);
 if(!codes||!codes.has(requirementCode))return NextResponse.json({error:"Unknown requirement"},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());
 if(!inspectEvidence(file.type,bytes))return NextResponse.json({error:"Unsupported or invalid content; use PDF, PNG, JPEG or UTF-8 TXT"},{status:415});
 const filename=safeFilename(file.name);
 // Bound writes, and reject new uploads to completed audits again inside transaction.
 const result=await prisma.$transaction(async tx=>{
  const audit=await tx.audit.findUnique({where:{id},select:{status:true}});
  if(!audit||audit.status==="COMPLETED")return null;
  const count=await tx.evidenceAsset.count({where:{auditId:id}});
  if(count>=maxEvidencePerAudit)return null;
  const asset=await tx.evidenceAsset.create({data:{auditId:id,requirementCode,filename,mimeType:file.type,sizeBytes:bytes.length,sha256:evidenceDigest(bytes),bytes,uploadedBy:process.env.SURFACE_AUDIT_ADMIN_USERNAME!},
   select:{id:true,requirementCode:true,filename:true,mimeType:true,sizeBytes:true,sha256:true,uploadedBy:true,createdAt:true}});
  await tx.auditEvent.create({data:{auditId:id,actor:process.env.SURFACE_AUDIT_ADMIN_USERNAME!,action:"EVIDENCE_FILE_ADDED",details:{assetId:asset.id,requirementCode,filename,sha256:asset.sha256,sizeBytes:asset.sizeBytes}}});
  return asset;
 });
 if(!result)return NextResponse.json({error:"Audit sealed or evidence limit reached"},{status:409});
 return NextResponse.json({asset:result},{status:201,headers:{"Cache-Control":"no-store"}});
}
