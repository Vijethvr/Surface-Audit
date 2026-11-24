import {NextResponse} from "next/server";
import {z} from "zod";import {prisma} from "@/lib/db";import {requireLocalPrototype} from "@/lib/dev-api";import {requirementCodes} from "@/lib/audit-requirements";
export const runtime="nodejs";export const dynamic="force-dynamic";
const input=z.object({requirementCode:z.string().min(1).max(30),reference:z.string().trim().min(2).max(500),description:z.string().trim().max(1000).optional()});
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;if(!await requirementCodes(id))return NextResponse.json({error:"Audit not found"},{status:404});
 const evidence=await prisma.evidenceReference.findMany({where:{auditId:id},orderBy:{createdAt:"desc"},take:500});
 return NextResponse.json({evidence},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid evidence reference"},{status:400});
 const codes=await requirementCodes(id);if(!codes)return NextResponse.json({error:"Audit not found"},{status:404});
 if(!codes.has(parsed.data.requirementCode))return NextResponse.json({error:"Requirement not in audit"},{status:400});
 const evidence=await prisma.$transaction(async tx=>{
 const item=await tx.evidenceReference.create({data:{auditId:id,...parsed.data}});
 await tx.auditEvent.create({data:{auditId:id,actor:process.env.SURFACE_AUDIT_ADMIN_USERNAME!,action:"EVIDENCE_REFERENCE_ADDED",details:{evidenceId:item.id,requirementCode:item.requirementCode}}});return item;
 });
 return NextResponse.json({evidence},{status:201});
}