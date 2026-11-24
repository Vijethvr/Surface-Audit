import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const input=z.object({clientId:z.string().cuid(),name:z.string().trim().min(2).max(160),reference:z.string().trim().max(100).optional()});
export async function GET(request:Request){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const projects=await prisma.project.findMany({include:{client:{select:{name:true}}},orderBy:{createdAt:"desc"},take:300});
 return NextResponse.json({projects},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid project details"},{status:400});
 const client=await prisma.client.findUnique({where:{id:parsed.data.clientId}});
 if(!client)return NextResponse.json({error:"Client not found"},{status:404});
 const duplicate=await prisma.project.findUnique({where:{clientId_name:{clientId:parsed.data.clientId,name:parsed.data.name}}});
 if(duplicate)return NextResponse.json({error:"Project already exists for this client"},{status:409});
 const project=await prisma.project.create({data:parsed.data,include:{client:{select:{name:true}}}});
 return NextResponse.json({project},{status:201});
}
