import {prisma} from "@/lib/db";
import {asItems,milestone,deliverable,emptyLifecycle} from "@/lib/engagement-lifecycle";
import {digest,projectPackCsv,buildPortablePack,type ProjectPackContent} from "@/lib/project-pack";
import {reportDigest} from "@/lib/report-snapshot";

const AUDIT_LIMIT=100,ACTION_LIMIT=500,EVIDENCE_LIMIT=500;
const date=(value:Date|null)=>value?.toISOString().slice(0,10)??null;

export async function compileProjectPack(projectId:string){
 const project=await prisma.project.findUnique({where:{id:projectId},select:{
  id:true,name:true,reference:true,client:{select:{id:true,name:true}}
 }});
 if(!project)return null;
 const [plan,allAudits,allActions,allEvidence,audits,actions,evidence]=await Promise.all([
  prisma.engagementLifecycle.findUnique({where:{projectId},include:{events:{orderBy:{createdAt:"desc"},take:1}}}),
  prisma.audit.count({where:{projectId}}),
  prisma.correctiveAction.count({where:{finding:{audit:{projectId}}}}),
  prisma.evidenceAsset.count({where:{audit:{projectId}}}),
  prisma.audit.findMany({where:{projectId},select:{
   id:true,title:true,status:true,targetDate:true,
   reportSnapshot:{select:{sha256:true,report:true}},
   findings:{select:{status:true,actions:{select:{status:true}}}},
   _count:{select:{evidenceAssets:true}}
  },orderBy:[{createdAt:"asc"},{id:"asc"}],take:AUDIT_LIMIT}),
  prisma.correctiveAction.findMany({where:{finding:{audit:{projectId}}},select:{
   id:true,description:true,status:true,owner:true,dueDate:true,
   finding:{select:{title:true,severity:true,auditId:true}}
  },orderBy:[{createdAt:"asc"},{id:"asc"}],take:ACTION_LIMIT}),
  prisma.evidenceAsset.findMany({where:{audit:{projectId}},select:{
   id:true,auditId:true,filename:true,requirementCode:true,sha256:true,sizeBytes:true,uploadedBy:true,createdAt:true
  },orderBy:[{createdAt:"asc"},{id:"asc"}],take:EVIDENCE_LIMIT})
 ]);
 const complete=allAudits===audits.length&&allActions===actions.length&&allEvidence===evidence.length;
 const milestones=asItems(plan?.milestones??[],milestone);
 const deliverables=asItems(plan?.deliverables??[],deliverable);
 const auditRows=audits.map(a=>{
  const verified=!!a.reportSnapshot&&reportDigest(a.reportSnapshot.report)===a.reportSnapshot.sha256;
  return {id:a.id,title:a.title,status:a.status,targetDate:date(a.targetDate),
   reportSha256:a.reportSnapshot?.sha256??null,reportIntegrity:a.reportSnapshot?(verified?"VERIFIED" as const:"MISMATCH" as const):"MISSING" as const,
   reportUrl:"/reports/"+encodeURIComponent(a.id),
   dossierUrl:a.reportSnapshot&&verified?"/api/audits/"+encodeURIComponent(a.id)+"/dossier":null,
   findingCount:a.findings.length,openFindings:a.findings.filter(f=>f.status!=="CLOSED").length,
   actionCount:a.findings.reduce((n,f)=>n+f.actions.length,0),
   openActions:a.findings.reduce((n,f)=>n+f.actions.filter(x=>x.status!=="VERIFIED").length,0),
   evidenceFiles:a._count.evidenceAssets};
 });
 const actionRows=actions.map(a=>({id:a.id,auditId:a.finding.auditId,title:a.description,
  status:a.status,owner:a.owner,dueDate:date(a.dueDate),finding:a.finding.title,severity:a.finding.severity}));
 const evidenceRows=evidence.map(e=>({...e,createdAt:e.createdAt.toISOString()}));
 const blockers:string[]=[];
 if(!plan)blockers.push("No versioned engagement lifecycle exists");
 if(!complete)blockers.push("Project exceeds the bounded export limits; complete client package is unavailable");
 if(!plan?.objective.trim()||!plan?.scope.trim())blockers.push("Engagement objectives or scope are missing");
 if(!milestones.length||milestones.some(m=>m.status!=="DONE"))blockers.push("One or more project milestones are incomplete");
 if(!deliverables.length||deliverables.some(d=>d.status!=="ACCEPTED"))blockers.push("One or more project deliverables are not internally accepted");
 if(auditRows.some(a=>a.reportIntegrity==="MISMATCH"))blockers.push("A stored audit report failed integrity validation");
 if(deliverables.some(d=>d.auditId&&!auditRows.some(a=>a.id===d.auditId&&a.status==="COMPLETED"&&a.reportIntegrity==="VERIFIED")))
  blockers.push("One or more audit-linked deliverables lack a completed, verified sealed report");
 if(plan?.stage!=="CLOSED")blockers.push("Project lifecycle has not reached the Closed stage");
 const content:ProjectPackContent={generatedAt:new Date().toISOString(),
  client:project.client,project:{id:project.id,name:project.name,reference:project.reference},
  lifecycle:{revision:plan?.revision??0,stage:plan?.stage??emptyLifecycle.stage,
   objective:plan?.objective??"",scope:plan?.scope??"",exclusions:plan?.exclusions??"",
   commercialNote:plan?.commercialNote??"",milestones,deliverables,
   lastChange:plan?.events[0]?{revision:plan.events[0].revision,actor:plan.events[0].actor,
    summary:plan.events[0].summary,at:plan.events[0].createdAt.toISOString()}:null},
  audits:auditRows,actions:actionRows,evidence:evidenceRows,
  scope:{complete,counts:{audits:allAudits,actions:allActions,evidence:allEvidence},
   limits:{audits:AUDIT_LIMIT,actions:ACTION_LIMIT,evidence:EVIDENCE_LIMIT}},
  readiness:{ready:blockers.length===0,blockers}};
 return {content,portable:buildPortablePack(content),register:projectPackCsv(content),
  contentHash:digest(content)};
}
