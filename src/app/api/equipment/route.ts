import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const input=z.object({
 identifier:z.string().trim().min(2).max(90),
 name:z.string().trim().min(2).max(160),
 instrumentType:z.string().trim().min(2).max(120),
 manufacturer:z.string().trim().max(120).optional(),
 calibrationReference:z.string().trim().max(120).optional(),
 calibrationDue:z.string().date().nullable().optional(),
 notes:z.string().trim().max(2000).optional()
});
export async function GET(request:Request){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const equipment=await prisma.equipment.findMany({orderBy:{identifier:"asc"},take:300});
 return NextResponse.json({equipment},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid equipment details"},{status:400});
 const {calibrationDue,...rest}=parsed.data;
 const existing=await prisma.equipment.findUnique({where:{identifier:rest.identifier}});
 if(existing)return NextResponse.json({error:"Equipment identifier already exists"},{status:409});
 const equipment=await prisma.equipment.create({data:{...rest,calibrationDue:calibrationDue?new Date(calibrationDue+"T00:00:00.000Z"):null}});
 return NextResponse.json({equipment},{status:201});
}
