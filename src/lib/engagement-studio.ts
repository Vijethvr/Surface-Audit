import {prisma} from "@/lib/db";

// Internal local-development client engagement projection. Never includes
// evidence bytes or raw assessment records. All source counts are exact,
// but displayed records are explicitly bounded.
const maxClients=250,maxAudits=250,maxRows=500,maxProjects=150;
const todayUtc=()=>{const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())};
const date=(d:Date|null)=>d?.toISOString().slice(0,10)??null;

export async function loadEngagementDirectory(){
 const [clients,total]=await Promise.all([
  prisma.client.findMany({select:{id:true,name:true,_count:{select:{audits:true,projects:true}}},orderBy:{name:"asc"},take:maxClients}),
  prisma.client.count()
 ]);
 return {clients:clients.map(c=>({id:c.id,name:c.name,audits:c._count.audits,projects:c._count.projects})),
  clientCount:total,directoryTruncated:total>clients.length};
}
export async function loadClientEngagement(clientName:string,projectId?:string){
 const client=await prisma.client.findUnique({where:{name:clientName},select:{id:true,name:true}});
 if(!client)return null;
 const projects=await prisma.project.findMany({where:{clientId:client.id},select:{id:true,name:true,reference:true},orderBy:{name:"asc"},take:maxProjects+1});
 if(projectId&&!projects.some(p=>p.id===projectId)){
  // A project not in the displayed list may be valid if the client exceeds
  // the cap; resolve it explicitly and never broaden to another client.
  const linked=await prisma.project.findFirst({where:{id:projectId,clientId:client.id},select:{id:true,name:true,reference:true}});
  if(!linked)return null;
  projects.push(linked);
 }
 const scope={clientId:client.id,...(projectId?{projectId}:{})};
 const auditWhere={clientId:client.id,...(projectId?{projectId}:{})};
 const findingWhere={audit:auditWhere};
 const actionWhere={finding:{audit:auditWhere}};
 const assetWhere={audit:auditWhere};
 const [audits,findings,actions,assets,auditCount,findingCount,actionCount,assetCount]=await Promise.all([
  prisma.audit.findMany({where:auditWhere,select:{id:true,title:true,status:true,targetDate:true,createdAt:true,updatedAt:true,
   project:{select:{id:true,name:true,reference:true}},
   templateSnapshot:true,
   reportSnapshot:{select:{sha256:true,createdAt:true}},
   reviews:{orderBy:{reviewedAt:"desc"},take:1,select:{decision:true,reviewerName:true,reviewedAt:true}},
   _count:{select:{findings:true,evidenceAssets:true,evidenceReferences:true,equipmentLinks:true}}},orderBy:[{updatedAt:"desc"},{id:"asc"}],take:maxAudits}),
  prisma.finding.findMany({where:findingWhere,select:{id:true,auditId:true,title:true,severity:true,status:true,requirementCode:true},
   orderBy:[{createdAt:"desc"},{id:"asc"}],take:maxRows}),
  prisma.correctiveAction.findMany({where:actionWhere,select:{id:true,description:true,owner:true,status:true,dueDate:true,closureEvidence:true,verifiedBy:true,
   finding:{select:{id:true,title:true,severity:true,auditId:true,audit:{select:{title:true}}}}}},
   orderBy:[{createdAt:"desc"},{id:"asc"}],take:maxRows}),
  prisma.evidenceAsset.findMany({where:assetWhere,select:{id:true,auditId:true,filename:true,requirementCode:true,mimeType:true,sizeBytes:true,sha256:true,createdAt:true,
   audit:{select:{title:true}}},uploadedBy:true},orderBy:[{createdAt:"desc"},{id:"asc"}],take:maxRows}),
  prisma.audit.count({where:auditWhere}),prisma.finding.count({where:findingWhere}),
  prisma.correctiveAction.count({where:actionWhere}),prisma.evidenceAsset.count({where:assetWhere})
 ]);
 const utc=todayUtc();
 const auditRows=audits.map(a=>({
  id:a.id,title:a.title,status:a.status,project:a.project?.name??null,projectId:a.project?.id??null,
  targetDate:date(a.targetDate),createdAt:a.createdAt.toISOString(),updatedAt:a.updatedAt.toISOString(),
  template:(a.templateSnapshot as {title?:string;revision?:string}|null)?.title??"Standard checklist",
  templateRevision:(a.templateSnapshot as {revision?:string}|null)?.revision??null,
  sealed:Boolean(a.reportSnapshot),sealedAt:a.reportSnapshot?.createdAt.toISOString()??null,
  reportSha256:a.reportSnapshot?.sha256??null,
  latestReview:a.reviews[0]?{decision:a.reviews[0].decision,reviewer:a.reviews[0].reviewerName,at:a.reviews[0].reviewedAt.toISOString()}:null,
  counts:{findings:a._count.findings,evidenceFiles:a._count.evidenceAssets,evidenceReferences:a._count.evidenceReferences,equipment:a._count.equipmentLinks}
 }));
 const findingRows=findings.map(f=>({id:f.id,auditId:f.auditId,title:f.title,severity:f.severity,status:f.status,requirementCode:f.requirementCode}));
 const actionRows=actions.map(a=>({id:a.id,auditId:a.finding.auditId,auditTitle:a.finding.audit.title,findingId:a.finding.id,finding:a.finding.title,
  severity:a.finding.severity,description:a.description,owner:a.owner,status:a.status,dueDate:date(a.dueDate),
  verifiedBy:a.verifiedBy,hasClosureEvidence:Boolean(a.closureEvidence),
  overdue:a.status!=="VERIFIED"&&a.dueDate!==null&&a.dueDate.getTime()<utc}));
 const assetRows=assets.map(a=>({id:a.id,auditId:a.auditId,auditTitle:a.audit.title,filename:a.filename,requirementCode:a.requirementCode,
  mimeType:a.mimeType,sizeBytes:a.sizeBytes,sha256:a.sha256,uploadedBy:a.uploadedBy,createdAt:a.createdAt.toISOString()}));
 const unverified=actionRows.filter(a=>a.status!=="VERIFIED");
 const openFindings=findingRows.filter(f=>f.status!=="CLOSED");
 const scopeTotals={audits:auditCount,findings:findingCount,actions:actionCount,evidenceFiles:assetCount};
 const sample={audits:auditRows.length,findings:findingRows.length,actions:actionRows.length,evidenceFiles:assetRows.length};
 const truncated=Object.keys(scopeTotals).some(k=>scopeTotals[k as keyof typeof scopeTotals]>sample[k as keyof typeof sample]);
 return {asOf:new Date().toISOString(),client,selectedProject:projectId??null,
  projects:projects.slice(0,maxProjects).map(p=>({id:p.id,name:p.name,reference:p.reference})),
  projectsTruncated:projects.length>maxProjects,
  scope:{totals:scopeTotals,sample,truncated,warning:"Full database counts are exact per selected scope; detailed lists and derived metrics are sampled at 250 audits and 500 records per finding/action/evidence category."},
  metrics:{activeAudits:auditRows.filter(a=>a.status!=="COMPLETED").length,
   completedAudits:auditRows.filter(a=>a.status==="COMPLETED").length,
   sealedReports:auditRows.filter(a=>a.sealed).length,
   openFindings:openFindings.length,
   criticalOpenFindings:openFindings.filter(f=>f.severity==="HIGH"||f.severity==="CRITICAL").length,
   unverifiedActions:unverified.length,
   overdueActions:unverified.filter(a=>a.overdue).length,
   missingActionDates:unverified.filter(a=>!a.dueDate).length,evidenceFiles:assetRows.length},
  audits:auditRows,findings:findingRows,actions:actionRows,evidence:assetRows,
  deliverables:auditRows.map(a=>({auditId:a.id,title:a.title,status:a.status,reportSealed:a.sealed,reportSha256:a.reportSha256,
    reportPath:"/reports/"+encodeURIComponent(a.id),dossierPath:a.sealed?"/api/audits/"+encodeURIComponent(a.id)+"/dossier":null,
    evidenceFiles:a.counts.evidenceFiles,latestReview:a.latestReview}))};
}

export function csvSafe(value:unknown){
 const raw=value==null?"":String(value);
 const safe=/^[\s\uFEFF]*[=+@\-]/u.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function engagementCsv(data:NonNullable<Awaited<ReturnType<typeof loadClientEngagement>>>){
 const rows:(string|number|null)[][]=[
  ["SURFACE Audit — INTERNAL DEVELOPMENT ENGAGEMENT HANDOFF"],
  ["Client",data.client.name],["Project",data.projects.find(p=>p.id===data.selectedProject)?.name??"All client projects"],
  ["Generated",data.asOf],["Scope",data.scope.warning],["Sample truncated",String(data.scope.truncated)],
  [],
  ["SECTION","AUDIT","TITLE / DESCRIPTION","STATUS","OWNER","DUE DATE","SEVERITY","EVIDENCE / SIGNATURE"],
  ...data.audits.map(a=>["AUDIT",a.id,a.title,a.status,"",a.targetDate,"",a.sealed?"Sealed snapshot "+a.reportSha256:"Draft / not sealed"]),
  ...data.actions.map(a=>["CAPA",a.auditId,a.description,a.status,a.owner,a.dueDate,a.severity,a.verifiedBy??""]),
  ...data.evidence.map(e=>["EVIDENCE",e.auditId,e.filename,e.requirementCode,e.uploadedBy,e.createdAt,"",e.sha256])
 ];
 return "\uFEFF"+rows.map(row=>row.map(csvSafe).join(",")).join("\r\n")+"\r\n";
}
