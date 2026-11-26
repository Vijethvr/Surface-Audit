import {createHash} from "node:crypto";

// Stable canonical JSON for integrity checks across JSON property order.
export function canonical(value:unknown):string{
 if(Array.isArray(value))return "["+value.map(v=>canonical(v)).join(",")+"]";
 if(value!==null&&typeof value==="object"){
  const object=value as Record<string,unknown>;
  return "{"+Object.keys(object).sort().map(k=>JSON.stringify(k)+":"+canonical(object[k])).join(",")+"}";
 }
 return JSON.stringify(value);
}
export function digest(value:unknown){return createHash("sha256").update(canonical(value)).digest("hex")}
export function buildPortablePack(content:Record<string,unknown>){
 return {format:"surface-audit-project-pack-v1",hashAlgorithm:"SHA-256",content,contentSha256:digest(content),
  notice:"Local development handoff; checksum detects accidental changes only. Not signed, approved or client-authenticated."};
}
export function csvCell(value:unknown){
 const raw=value==null?"":String(value);
 const safe=/^[\s\uFEFF]*[=+@-]/u.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function projectPackCsv(content:ProjectPackContent){
 const rows:(string|number|null)[][]=[
 ["SURFACE AUDIT — PROJECT HANDOFF / DEVELOPMENT COPY"],
 ["Client",content.client.name],["Project",content.project.name],["Reference",content.project.reference],
 ["Snapshot",content.generatedAt],["Lifecycle revision",content.lifecycle.revision],["Stage",content.lifecycle.stage],
 ["Complete scope",String(content.scope.complete)],["Outstanding blockers",content.readiness.blockers.length],
 [],["SECTION","ID","TITLE","STATUS","OWNER","DUE","DETAIL"],
 ...content.lifecycle.milestones.map(m=>["MILESTONE",m.id,m.title,m.status,m.owner,m.dueDate,m.note]),
 ...content.lifecycle.deliverables.map(d=>["DELIVERABLE",d.id,d.title,d.status,d.acceptedBy,d.dueDate,d.acceptanceNote]),
 ...content.audits.map(a=>["AUDIT",a.id,a.title,a.status,"",a.targetDate,a.reportSha256??"No sealed report"]),
 ...content.actions.map(a=>["CAPA",a.id,a.title,a.status,a.owner,a.dueDate,a.finding]),
 ...content.evidence.map(e=>["EVIDENCE",e.id,e.filename,e.requirementCode,e.uploadedBy,e.createdAt,e.sha256]),
 ...content.readiness.blockers.map((b,i)=>["BLOCKER",i+1,b,"","","",""])
 ];
 return "\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
}
export type ProjectPackContent={
 generatedAt:string;client:{id:string;name:string};project:{id:string;name:string;reference:string|null};
 lifecycle:{revision:number;stage:string;objective:string;scope:string;exclusions:string;commercialNote:string;
  milestones:Array<{id:string;title:string;owner:string;dueDate:string|null;status:string;note:string}>;
  deliverables:Array<{id:string;title:string;description:string;auditId:string|null;dueDate:string|null;status:string;acceptedBy:string;acceptanceNote:string}>;
  lastChange:{revision:number;actor:string;summary:string;at:string}|null};
 audits:Array<{id:string;title:string;status:string;targetDate:string|null;reportSha256:string|null;reportIntegrity:"VERIFIED"|"MISSING"|"MISMATCH";
  reportUrl:string;dossierUrl:string|null;findingCount:number;openFindings:number;actionCount:number;openActions:number;evidenceFiles:number}>;
 actions:Array<{id:string;auditId:string;title:string;status:string;owner:string;dueDate:string|null;finding:string;severity:string}>;
 evidence:Array<{id:string;auditId:string;filename:string;requirementCode:string;sha256:string;sizeBytes:number;uploadedBy:string;createdAt:string}>;
 readiness:{ready:boolean;blockers:string[]};scope:{complete:boolean;counts:{audits:number;actions:number;evidence:number};
  limits:{audits:number;actions:number;evidence:number}};
};
