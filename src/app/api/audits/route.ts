import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireLocalPrototype } from "@/lib/dev-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  client: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(120).default("Measurement assurance"),
});

const statusMap = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
} as const;

function serialize(a: {
  id: string; title: string; type: string; status: keyof typeof statusMap;
  targetDate: Date | null; client: { name: string }; record: { content: unknown } | null;
}) {
  const content = a.record?.content as {answers?:Record<string,{answer?:string}>}|undefined;
  const assessed = Object.values(content?.answers ?? {}).filter(x => x?.answer && x.answer !== "Not assessed").length;
  return {
    id: a.id, title: a.title, type: a.type,
    client: a.client.name, status: statusMap[a.status],
    date: a.targetDate ? a.targetDate.toLocaleDateString("en-GB",{ day:"2-digit",month:"short",year:"numeric",timeZone:"UTC" }) : "Not scheduled",
    progress: Math.min(100,Math.round(assessed / 8 * 100))
  };
}

export async function GET() {
  const denied = requireLocalPrototype(); if (denied) return denied;
  try {
    const rows = await prisma.audit.findMany({
      include:{client:true,record:true},
      orderBy:{createdAt:"desc"},take:250
    });
    return NextResponse.json({ audits: rows.map(serialize) },{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Unable to read audit records. Check PostgreSQL configuration."},{status:503});
  }
}

export async function POST(request:Request) {
  const denied = requireLocalPrototype(); if (denied) return denied;
  let payload:unknown;
  try {payload=await request.json();} catch {return NextResponse.json({error:"Invalid JSON body"},{status:400});}
  const parsed=createInput.safeParse(payload);
  if(!parsed.success)return NextResponse.json({error:"Invalid audit details",issues:parsed.error.flatten()},{status:400});
  try{
    const {title,client,type}=parsed.data;
    const row=await prisma.audit.create({
      data:{title,type,client:{connectOrCreate:{where:{name:client},create:{name:client}}}},
      include:{client:true,record:true}
    });
    return NextResponse.json({audit:serialize(row)},{status:201});
  }catch{return NextResponse.json({error:"Unable to create audit."},{status:500});}
}
