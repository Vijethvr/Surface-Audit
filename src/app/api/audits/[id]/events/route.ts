import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  const denied=requireLocalPrototype(request);if(denied)return denied;
  const {id}=await context.params;
  const events=await prisma.auditEvent.findMany({where:{auditId:id},orderBy:{createdAt:"asc"},take:500});
  return NextResponse.json({events},{headers:{"Cache-Control":"no-store"}});
}
