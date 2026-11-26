import {NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {asItems,deliverable,emptyLifecycle,input,milestone} from "@/lib/engagement-lifecycle";
export const runtime="nodejs";export const dynamic="force-dynamic";

export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await context.params;
 const project=await prisma.project.findUnique({where:{id},select:{id:true,name:true,reference:true,client:{select:{name:true}},audits:{select:{id:true,title:true,status:true,reportSnapshot:{select:{id:true}}},orderBy:{createdAt:"desc"},take:250}}});
 if(!project)return NextResponse.json({error:"Project not found"},{status:404});
 const [plan,totals]=await Promise.all([
  prisma.engagementLifecycle.findUnique({where:{projectId:id},include:{events:{orderBy:{createdAt:"desc"},take:100}}}),
  prisma.audit.count({where:{projectId:id}})
 ]);
 const {events,...value}=plan??{...emptyLifecycle,id:null,projectId:id,createdAt:null,updatedAt:null,events:[]};
 return NextResponse.json({project:{...project,auditCount:totals,auditsTruncated:totals>project.audits.length},
  plan:{...value,milestones:asItems(value.milestones,milestone),deliverables:asItems(value.deliverables,deliverable)},
  history:events},{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await context.params;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid lifecycle plan",issues:parsed.error.flatten()}, {status:400});
 const values=parsed.data;
 const project=await prisma.project.findUnique({where:{id},select:{id:true}});
 if(!project)return NextResponse.json({error:"Project not found"},{status:404});
 const linkedIds=[...new Set(values.deliverables.map(d=>d.auditId).filter((id):id is string=>Boolean(id)))];
 if(linkedIds.length){
  const linked=await prisma.audit.findMany({where:{id:{in:linkedIds},projectId:id},
   select:{id:true,status:true,reportSnapshot:{select:{id:true}}}});
  if(linked.length!==linkedIds.length)return NextResponse.json({error:"Deliverable links must reference audits in this project"},{status:409});
  if(values.deliverables.some(d=>d.auditId&&d.status==="ACCEPTED"&&
   !linked.some(a=>a.id===d.auditId&&a.status==="COMPLETED"&&a.reportSnapshot)))
   return NextResponse.json({error:"An audit-linked deliverable needs a completed, sealed audit report before internal acceptance"},{status:409});
 }
 const actor=(await getSession(request))!.username;
 const data={objective:values.objective,scope:values.scope,exclusions:values.exclusions,commercialNote:values.commercialNote,
  stage:values.stage,milestones:values.milestones as Prisma.InputJsonValue,deliverables:values.deliverables as Prisma.InputJsonValue};
 try{
  const outcome=await prisma.$transaction(async tx=>{
   const current=await tx.engagementLifecycle.findUnique({where:{projectId:id}});
   if(!current){
    if(values.expectedRevision!==0)throw Error("STALE_LIFECYCLE");
    const created=await tx.engagementLifecycle.create({data:{projectId:id,revision:1,...data}});
    await tx.engagementLifecycleEvent.create({data:{lifecycleId:created.id,revision:1,actor,action:"PLAN_CREATED",summary:values.summary}});
    return created;
   }
   if(current.stage==="CLOSED")throw Error("LIFECYCLE_CLOSED");
   const updated=await tx.engagementLifecycle.updateMany({where:{id:current.id,revision:values.expectedRevision},data:{...data,revision:{increment:1}}});
   if(updated.count!==1)throw Error("STALE_LIFECYCLE");
   await tx.engagementLifecycleEvent.create({data:{lifecycleId:current.id,revision:values.expectedRevision+1,actor,
    action:values.stage==="CLOSED"?"PLAN_CLOSED":values.stage!==current.stage?"STAGE_CHANGED":"PLAN_UPDATED",summary:values.summary}});
   return await tx.engagementLifecycle.findUniqueOrThrow({where:{id:current.id}});
  });
  return NextResponse.json({ok:true,revision:outcome.revision,stage:outcome.stage},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  if(error instanceof Error&&error.message==="LIFECYCLE_CLOSED")return NextResponse.json({error:"Closed lifecycle plans cannot be changed"},{status:409});
  if(error instanceof Error&&error.message==="STALE_LIFECYCLE"||
    error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")
   return NextResponse.json({error:"Project lifecycle changed while editing; reload before saving"},{status:409});
  throw error;
 }
}
