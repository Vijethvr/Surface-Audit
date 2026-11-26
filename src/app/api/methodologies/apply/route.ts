import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {applicationInput,blueprint,builtins,offsetDate} from "@/lib/methodologies";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};

export async function POST(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const parsed=applicationInput.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid methodology application",issues:parsed.error.flatten()},{status:400,headers});
 const data=parsed.data;
 try{offsetDate(data.startDate,0)}catch{return NextResponse.json({error:"Invalid calendar start date"},{status:400,headers})}
 const selected=builtins.find(x=>x.id===data.methodologyId);
 const custom=selected?null:await prisma.consultingMethodology.findUnique({where:{id:data.methodologyId}});
 const source=selected??(custom?{id:custom.id,title:custom.title,description:custom.description,
  revision:custom.revision,blueprint:custom.blueprint,builtin:false}:null);
 if(!source)return NextResponse.json({error:"Methodology not found"},{status:404,headers});
 const valid=blueprint.safeParse(source.blueprint);
 if(!valid.success)return NextResponse.json({error:"Stored methodology blueprint is invalid"},{status:409,headers});
 const client=await prisma.client.findUnique({where:{id:data.clientId},select:{id:true,name:true}});
 if(!client)return NextResponse.json({error:"Client not found"},{status:404,headers});
 const actor=(await getSession(request))!.username;
 const frozen={sourceId:source.id,title:source.title,revision:source.revision,description:source.description,
  blueprint:valid.data,appliedAt:new Date().toISOString(),startDate:data.startDate,appliedBy:actor};
 try{
  const result=await prisma.$transaction(async tx=>{
   const project=await tx.project.create({data:{
    clientId:client.id,name:data.projectName,reference:data.reference??null,
    methodologySnapshot:frozen as Prisma.InputJsonValue
   }});
   const linked=new Map<string,string>();
   for(const spec of valid.data.audits){
    const target=offsetDate(data.startDate,spec.offsetDays);
    const audit=await tx.audit.create({data:{
     title:spec.title,type:spec.type,clientId:client.id,projectId:project.id,
     targetDate:target?new Date(target+"T00:00:00Z"):null,
     templateSnapshot:{title:spec.title,revision:source.revision,methodologyId:source.id,
      methodologyAuditKey:spec.key,criteria:spec.criteria},
     events:{create:{actor,action:"AUDIT_CREATED",details:{source:"methodology",projectId:project.id,
      methodologyId:source.id,revision:source.revision,auditKey:spec.key}}}
    }});
    linked.set(spec.key,audit.id);
   }
   const milestones=valid.data.milestones.map(spec=>({id:randomUUID(),title:spec.title,
    owner:spec.owner||data.owner||"",dueDate:offsetDate(data.startDate,spec.offsetDays),
    status:"PLANNED",note:spec.note}));
   const deliverables=valid.data.deliverables.map(spec=>({id:randomUUID(),title:spec.title,
    description:spec.description,auditId:spec.auditKey?linked.get(spec.auditKey)??null:null,
    dueDate:offsetDate(data.startDate,spec.offsetDays),status:"PLANNED",
    acceptedBy:"",acceptanceNote:""}));
   const life=await tx.engagementLifecycle.create({data:{projectId:project.id,revision:1,stage:"SCOPED",
    objective:valid.data.objective,scope:valid.data.scope,exclusions:valid.data.exclusions,
    commercialNote:"",milestones:milestones as Prisma.InputJsonValue,deliverables:deliverables as Prisma.InputJsonValue}});
   await tx.engagementLifecycleEvent.create({data:{lifecycleId:life.id,revision:1,actor,
    action:"METHODOLOGY_APPLIED",summary:"Initialized from "+source.title+" revision "+source.revision}});
   return {project,life,auditIds:[...linked.values()]};
  });
  return NextResponse.json({ok:true,projectId:result.project.id,projectName:result.project.name,
   clientName:client.name,methodology:{id:source.id,title:source.title,revision:source.revision},
   lifecycleRevision:result.life.revision,auditIds:result.auditIds,
   milestoneCount:valid.data.milestones.length,deliverableCount:valid.data.deliverables.length,
   planUrl:"/engagements/"+result.project.id+"/plan",
   packUrl:"/engagements/"+result.project.id+"/pack"},{status:201,headers});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")
   return NextResponse.json({error:"Project already exists for this client"},{status:409,headers});
  throw error;
 }
}
