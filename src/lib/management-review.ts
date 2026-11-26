import {loadOperations} from "@/lib/operations";

type Portfolio=Awaited<ReturnType<typeof loadOperations>>;
type Audit=Portfolio["audits"][number];
type Action=Portfolio["actions"][number];
type Finding=Portfolio["findings"][number];

export function buildManagementReview(data:Portfolio,client?:string){
 const clients=[...new Set(data.audits.map(a=>a.client).concat(data.actions.map(a=>a.client),data.findings.map(f=>f.client)))].sort((a,b)=>a.localeCompare(b));
 if(client&&!clients.includes(client))return null;
 const audits=data.audits.filter(a=>!client||a.client===client);
 const actions=data.actions.filter(a=>!client||a.client===client);
 const findings=data.findings.filter(f=>!client||f.client===client);
 const now=new Date(data.asOf);
 const midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const openActions=actions.filter(a=>a.status!=="VERIFIED");
 const openFindings=findings.filter(f=>f.status!=="CLOSED");
 const critical=openFindings.filter(f=>f.severity==="CRITICAL"||f.severity==="HIGH");
 const overdue=openActions.filter(a=>a.dueDate&&new Date(a.dueDate).getTime()<midnight);
 const missingDue=openActions.filter(a=>!a.dueDate);
 const missingOwner=openActions.filter(a=>!a.owner.trim());
 const aging={oneToSeven:0,eightToThirty:0,overThirty:0};
 for(const a of overdue){
  const days=Math.floor((midnight-new Date(a.dueDate!).getTime())/86400000);
  if(days<=7)aging.oneToSeven++;else if(days<=30)aging.eightToThirty++;else aging.overThirty++;
 }
 const actionClientNames=[...new Set([...audits.map(a=>a.client),...actions.map(a=>a.client),...findings.map(f=>f.client)])];
 const clientsRisk=actionClientNames.map(name=>{
  const ac=openActions.filter(a=>a.client===name),fi=openFindings.filter(f=>f.client===name);
  const late=ac.filter(a=>a.dueDate&&new Date(a.dueDate).getTime()<midnight).length;
  const severe=fi.filter(f=>f.severity==="HIGH"||f.severity==="CRITICAL").length;
  const undated=ac.filter(a=>!a.dueDate).length;
  const unowned=ac.filter(a=>!a.owner.trim()).length;
  // Triage score is an operational heuristic, NEVER a regulatory/compliance rating.
  const score=late*3+severe*2+undated+unowned;
  return {client:name,score,openActions:ac.length,overdueActions:late,highCriticalFindings:severe,missingDueDates:undated,missingOwners:unowned,audits:audits.filter(a=>a.client===name).length};
 }).sort((a,b)=>b.score-a.score||a.client.localeCompare(b.client));
 const pastSix=Array.from({length:6},(_,index)=>{
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-(5-index),1));
  const month=date.toISOString().slice(0,7);
  // Updated-at month is NOT a reliable completion timestamp; show audit creation cohort instead.
  return {month,started:audits.filter(a=>a.createdAt.slice(0,7)===month).length};
 });
 const priorityActions=[...openActions].map(a=>({
  auditId:a.auditId,client:a.client,auditTitle:a.auditTitle,owner:a.owner,
  description:a.description,dueDate:a.dueDate,
  daysOverdue:a.dueDate?Math.max(0,Math.floor((midnight-new Date(a.dueDate).getTime())/86400000)):null,
  findingSeverity:findings.find(f=>f.id===a.findingId)?.severity??"UNKNOWN"
 })).sort((a,b)=>(b.daysOverdue??-1)-(a.daysOverdue??-1)||
  (["CRITICAL","HIGH","MEDIUM","LOW"].indexOf(a.findingSeverity)-["CRITICAL","HIGH","MEDIUM","LOW"].indexOf(b.findingSeverity)));
 const truncated={audits:data.audits.length>=data.limit,findings:data.findings.length>=data.limit,actions:data.actions.length>=data.limit,evidence:data.evidence.length>=data.limit};
 return {
  formatVersion:"surface-audit-management-review-v2",asOf:data.asOf,selectedClient:client||null,
  clients,scope:{limitPerCategory:data.limit,truncated,notWholeDatabase:Object.values(truncated).some(Boolean),
   warning:"Management snapshot covers only the most recently returned 500 records per source category. Counts and risk scores may be incomplete. No external accreditation or evidence validation."},
  metrics:{audits:audits.length,activeAudits:audits.filter(a=>a.status==="IN_PROGRESS"||a.status==="IN_REVIEW").length,
   scheduledAudits:audits.filter(a=>a.status==="SCHEDULED").length,completedAudits:audits.filter(a=>a.status==="COMPLETED").length,
   sealedReports:audits.filter(a=>a.sealed).length,openActions:openActions.length,overdueActions:overdue.length,
   highCriticalFindings:critical.length,openFindings:openFindings.length,missingDueDates:missingDue.length,missingOwners:missingOwner.length,
   overdueOverThirtyDays:aging.overThirty},
  overdueAging:aging,topRiskClients:clientsRisk.slice(0,15),priorityActions:priorityActions.slice(0,25),
  auditStartsByMonth:pastSix,
  countsByStatus:["SCHEDULED","IN_PROGRESS","IN_REVIEW","COMPLETED"].map(status=>({status,count:audits.filter(a=>a.status===status).length})),
  generatedBy:"Development prototype — management triage only; not compliance certification"
 };
}
export async function loadManagementReview(client?:string){return buildManagementReview(await loadOperations(),client)}
