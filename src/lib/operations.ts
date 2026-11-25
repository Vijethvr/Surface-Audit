import {prisma} from "@/lib/db";
export async function loadOperations(){
 const [audits,findings,actions,evidence]=await Promise.all([
  prisma.audit.findMany({select:{id:true,title:true,status:true,createdAt:true,updatedAt:true,client:{select:{name:true}},project:{select:{name:true}},reportSnapshot:{select:{sha256:true,createdAt:true}}},orderBy:{updatedAt:"desc"},take:500}),
  prisma.finding.findMany({include:{audit:{select:{id:true,title:true,client:{select:{name:true}}}},actions:{select:{id:true,status:true}}},orderBy:{createdAt:"desc"},take:500}),
  prisma.correctiveAction.findMany({include:{finding:{select:{id:true,title:true,requirementCode:true,audit:{select:{id:true,title:true,client:{select:{name:true}}}}}}},orderBy:{createdAt:"desc"},take:500}),
  prisma.evidenceReference.findMany({include:{audit:{select:{id:true,title:true,client:{select:{name:true}}}}},orderBy:{createdAt:"desc"},take:500})
 ]);
 const today=new Date();today.setUTCHours(0,0,0,0);
 const auditsView=audits.map(a=>({id:a.id,title:a.title,client:a.client.name,project:a.project?.name??"",status:a.status,createdAt:a.createdAt.toISOString(),updatedAt:a.updatedAt.toISOString(),sealed:Boolean(a.reportSnapshot),sha256:a.reportSnapshot?.sha256??null}));
 const findingsView=findings.map(f=>({id:f.id,auditId:f.audit.id,auditTitle:f.audit.title,client:f.audit.client.name,code:f.requirementCode,title:f.title,severity:f.severity,status:f.status,actions:f.actions.length,openActions:f.actions.filter(a=>a.status!=="VERIFIED").length,createdAt:f.createdAt.toISOString()}));
 const actionsView=actions.map(a=>({id:a.id,findingId:a.finding.id,auditId:a.finding.audit.id,auditTitle:a.finding.audit.title,client:a.finding.audit.client.name,requirementCode:a.finding.requirementCode,description:a.description,owner:a.owner,status:a.status,dueDate:a.dueDate?.toISOString()??null,overdue:Boolean(a.dueDate&&a.dueDate<today&&a.status!=="VERIFIED"),closureEvidence:a.closureEvidence??null,verifiedBy:a.verifiedBy??null}));
 const evidenceView=evidence.map(e=>({id:e.id,auditId:e.audit.id,auditTitle:e.audit.title,client:e.audit.client.name,requirementCode:e.requirementCode,reference:e.reference,description:e.description??"",createdAt:e.createdAt.toISOString()}));
 return {asOf:new Date().toISOString(),summary:{audits:auditsView.length,activeAudits:auditsView.filter(a=>a.status==="IN_PROGRESS"||a.status==="IN_REVIEW").length,completedAudits:auditsView.filter(a=>a.status==="COMPLETED").length,openFindings:findingsView.filter(f=>f.status!=="CLOSED").length,openActions:actionsView.filter(a=>a.status!=="VERIFIED").length,overdueActions:actionsView.filter(a=>a.overdue).length,evidenceReferences:evidenceView.length,sealedReports:auditsView.filter(a=>a.sealed).length},audits:auditsView,findings:findingsView,actions:actionsView,evidence:evidenceView,limit:500};
}
