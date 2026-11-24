import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const input=z.object({
 title:z.string().trim().min(2).max(160),
 description:z.string().trim().max(1000).optional(),
 revision:z.string().trim().min(1).max(40).default("1.0"),
 criteria:z.array(z.object({code:z.string().trim().min(1).max(30),text:z.string().trim().min(2).max(500)})).min(1).max(100)
});
export async function GET(request:Request){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const templates=await prisma.auditTemplate.findMany({orderBy:{createdAt:"desc"},take:150});
 return NextResponse.json({templates},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid template details"},{status:400});
 const existing=await prisma.auditTemplate.findUnique({where:{title:parsed.data.title}});
 if(existing)return NextResponse.json({error:"Template title already exists"},{status:409});
 const template=await prisma.auditTemplate.create({data:parsed.data});
 return NextResponse.json({template},{status:201});
}
