import { prisma } from "@/lib/db";
import {evidenceDigest} from "@/lib/evidence-vault";

export const defaultRequirements=[
  {code:"REQ-01",text:"Drawing and specification requirements identified"},
  {code:"REQ-02",text:"Measurement procedure suitable for intended purpose"},
  {code:"REQ-03",text:"Instrument identity and calibration status verified"},
  {code:"REQ-04",text:"Reference artifact and verification records reviewed"},
  {code:"REQ-05",text:"Operator competence and authorization reviewed"},
  {code:"REQ-06",text:"Measurement environment and sample preparation recorded"},
  {code:"REQ-07",text:"Measurement result linked to the correct part and specification"},
  {code:"REQ-08",text:"Uncertainty and conformity decision rule documented"}
] as const;

type ResponseEntry={answer?:string;comment?:string;reference?:string};
type Assessment={answers?:Record<string,ResponseEntry>;summary?:string;reviewer?:string};
type Criteria={code:string;text:string};
export async function buildAuditReport(id:string){
 const audit=await prisma.audit.findUnique({where:{id},include:{
  client:true,project:true,record:true,
  equipmentLinks:{include:{equipment:true},orderBy:{assignedAt:"asc"}},
  evidenceReferences:{orderBy:{createdAt:"asc"}},
  evidenceAssets:{orderBy:{createdAt:"asc"}},
  findings:{include:{actions:{orderBy:{createdAt:"asc"}}},orderBy:{createdAt:"asc"}},
  events:{orderBy:{createdAt:"asc"},take:500}
 }});
 if(!audit)return null;
 const snapshot=audit.templateSnapshot as {title?:string;revision?:string;criteria?:Criteria[]}|null;
 const requirements=Array.isArray(snapshot?.criteria)?snapshot.criteria:Array.from(defaultRequirements);
 const content=(audit.record?.content??{}) as Assessment;
 const answers=content.answers??{};
 const blockers:string[]=[];
 for(const asset of audit.evidenceAssets){
  if(evidenceDigest(Buffer.from(asset.bytes))!==asset.sha256 || asset.sizeBytes!==asset.bytes.length)blockers.push("Evidence file "+asset.id+" failed integrity validation.");
 }
 if(!content.reviewer?.trim())blockers.push("Reviewer identifier is missing.");
 if(!content.summary?.trim())blockers.push("Overall assessment summary is missing.");
 for(const requirement of requirements){
  const a=answers[requirement.code];
  if(!a?.answer||a.answer==="Not assessed")blockers.push(requirement.code+": assessment is incomplete.");
  else{
   if(!a.comment?.trim()&&!a.reference?.trim())blockers.push(requirement.code+": record an observation or evidence reference.");
   if(a.answer==="Nonconformity"&&!audit.findings.some(f=>f.requirementCode===requirement.code))blockers.push(requirement.code+": nonconformity requires a structured finding.");
  }
 }
 for(const f of audit.findings){
  if(f.status!=="CLOSED")blockers.push("Finding "+f.id+" is not closed.");
  if(f.status==="CLOSED"&&(!f.actions.length||f.actions.some(a=>a.status!=="VERIFIED"||!a.closureEvidence||!a.verifiedBy)))blockers.push("Finding "+f.id+" lacks verified corrective-action evidence.");
 }
 const assessed=requirements.filter(r=>answers[r.code]?.answer&&answers[r.code].answer!=="Not assessed").length;
 const report={
  reportType:"SURFACE Audit development assessment summary",
  reportStatus:"UNAPPROVED DRAFT — NOT A COMPLIANCE CERTIFICATE",
  generatedAt:new Date().toISOString(),
  audit:{id:audit.id,title:audit.title,status:audit.status,type:audit.type,createdAt:audit.createdAt,updatedAt:audit.updatedAt,
   client:audit.client.name,project:audit.project?.name??null},
  template:{title:snapshot?.title??"Demonstration checklist",revision:snapshot?.revision??"demo-v0.2"},
  reviewer:content.reviewer??"",summary:content.summary??"",
  requirements:requirements.map(r=>({code:r.code,title:r.text,
   assessment:answers[r.code]?.answer??"Not assessed",observation:answers[r.code]?.comment??"",reference:answers[r.code]?.reference??"",
   evidenceReferences:audit.evidenceReferences.filter(e=>e.requirementCode===r.code).map(e=>({reference:e.reference,description:e.description})),
   evidenceFiles:audit.evidenceAssets.filter(e=>e.requirementCode===r.code).map(e=>({id:e.id,filename:e.filename,mimeType:e.mimeType,sizeBytes:e.sizeBytes,sha256:e.sha256,createdAt:e.createdAt})),
   findings:audit.findings.filter(f=>f.requirementCode===r.code).map(f=>({id:f.id,title:f.title,description:f.description,severity:f.severity,status:f.status,
    actions:f.actions.map(a=>({description:a.description,owner:a.owner,dueDate:a.dueDate,status:a.status,closureEvidence:a.closureEvidence,verifiedBy:a.verifiedBy,verifiedAt:a.verifiedAt}))}))
  })),
  equipment:audit.equipmentLinks.map(l=>({identifier:l.equipment.identifier,name:l.equipment.name,calibrationReference:l.equipment.calibrationReference,calibrationDue:l.equipment.calibrationDue})),
  counts:{assessed,total:requirements.length,findings:audit.findings.length,openFindings:audit.findings.filter(f=>f.status!=="CLOSED").length,evidenceReferences:audit.evidenceReferences.length,evidenceFiles:audit.evidenceAssets.length},
  readiness:{ready:blockers.length===0,blockers},
  activityCount:audit.events.length,
 };
 return report;
}
