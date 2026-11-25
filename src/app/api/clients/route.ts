import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const input=z.object({name:z.string().trim().min(2).max(160)});
export async function GET(request:Request){
 const denial=await requireLocalPrototype(request);if(denial)return denial;
 const clients=await prisma.client.findMany({orderBy:{name:"asc"},select:{id:true,name:true,_count:{select:{audits:true,projects:true}}}});
 return NextResponse.json({clients},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 const denial=await requireLocalPrototype(request);if(denial)return denial;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid client name"},{status:400});
 const existing=await prisma.client.findUnique({where:{name:parsed.data.name}});
 if(existing)return NextResponse.json({error:"A client with that name already exists"},{status:409});
 const client=await prisma.client.create({data:parsed.data});
 return NextResponse.json({client},{status:201});
}
