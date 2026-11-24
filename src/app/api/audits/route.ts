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
  projectId:z.string().cuid().optional(),
  templateId:z.string().cuid().optional(),
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
  project?:{id:string;name:string}|null;templateSnapshot?:unknown;
}) {
  const content = a.record?.content as {answers?:Record<string,{answer?:string}>}|undefined;
  const assessed = Object.values(content?.answers ?? {}).filter(x => x?.answer && x.answer !== "Not assessed").length;
  const snapshot=a.templateSnapshot as {criteria?:unknown[]}|null|undefined;
  const total=Array.isArray(snapshot?.criteria)?snapshot.criteria.length:8;
  return {
    id: a.id, title: a.title, type: a.type,
    client: a.client.name, status: statusMap[a.status],
    date: a.targetDate ? a.targetDate.toLocaleDateString("en-GB",{ day:"2-digit",month:"short",year:"numeric",timeZone:"UTC" }) : "Not scheduled",
    project:a.project?{id:a.project.id,name:a.project.name}:null,
    templateSnapshot:snapshot??null,
    progress: Math.min(100,Math.round(assessed / Math.max(1,total) * 100))
  };
}

export async function GET(request:Request) {
  const denied = requireLocalPrototype(request); if (denied) return denied;
  try {
    const rows = await prisma.audit.findMany({
      include:{client:true,record:true,project:true},
      orderBy:{createdAt:"desc"},take:250
    });
    return NextResponse.json({ audits: rows.map(serialize) },{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Unable to read audit records. Check PostgreSQL configuration."},{status:503});
  }
}

export async function POST(request:Request) {
  const denied = requireLocalPrototype(request); if (denied) return denied;
  let payload:unknown;
  try {payload=await request.json();} catch {return NextResponse.json({error:"Invalid JSON body"},{status:400});}
  const parsed=createInput.safeParse(payload);
  if(!parsed.success)return NextResponse.json({error:"Invalid audit details",issues:parsed.error.flatten()},{status:400});
  try{
    const {title,client,type,projectId,templateId}=parsed.data;
    // All links are validated before creation. A project from a different client is rejected.
    const project=projectId?await prisma.project.findUnique({where:{id:projectId},include:{client:true}}):null;
    if(projectId&&!project)return NextResponse.json({error:"Project not found"},{status:404});
    if(project&&project.client.name!==client)return NextResponse.json({error:"Project belongs to another client"},{status:409});
    const template=templateId?await prisma.auditTemplate.findUnique({where:{id:templateId}}):null;
    if(templateId&&!template)return NextResponse.json({error:"Template not found"},{status:404});
    const criteria=template?.criteria;
    if(template&&(!Array.isArray(criteria)||criteria.length<1||criteria.length>100))return NextResponse.json({error:"Template criteria invalid"},{status:422});
    // Snapshot the exact template criteria/revision. Later edits to the draft template
    // cannot change the assessment requirements of this audit.
    const templateSnapshot=template?{
      templateId:template.id,title:template.title,revision:template.revision,
      criteria:criteria
    }:undefined;
    const row=await prisma.audit.create({
      data:{title,type,client:{connectOrCreate:{where:{name:client},create:{name:client}}},
        ...(project?{project:{connect:{id:project.id}}}:{}),
        ...(template?{template:{connect:{id:template.id}},templateSnapshot}:{}),
        events:{create:{action:"AUDIT_CREATED",actor:process.env.SURFACE_AUDIT_ADMIN_USERNAME!,
          details:{source:"local-ui",projectId:projectId??null,templateId:templateId??null,templateRevision:template?.revision??null}}}},
      include:{client:true,record:true,project:true}
    });
    return NextResponse.json({audit:serialize(row)},{status:201});
  }catch{return NextResponse.json({error:"Unable to create audit."},{status:500});}
}
