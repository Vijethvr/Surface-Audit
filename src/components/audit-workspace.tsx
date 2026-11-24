"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,CheckCircle2,ClipboardCheck,FileText,Info,Save,ShieldCheck} from "lucide-react";
import type {Audit,Status} from "@/lib/demo-data";

type Answer="Not assessed"|"Conforms"|"Nonconformity"|"Not applicable";
type Entry={answer:Answer;comment:string;reference:string};
type AuditRecord={answers:Record<string,Entry>;summary:string;reviewer:string};
type Snapshot={title:string;revision:string;criteria:Array<{code:string;text:string}>};
type Instrument={id:string;identifier:string;name:string;calibrationDue:string|null};
const items=[
{id:"REQ-01",group:"Specification",title:"Drawing and specification requirements identified",detail:"Confirm the controlling drawing revision, specified surface characteristics, and applicable criteria."},
{id:"REQ-02",group:"Specification",title:"Measurement procedure suitable for intended purpose",detail:"Review documented measurement conditions and the correct applicable procedure."},
{id:"REQ-03",group:"Equipment",title:"Instrument identity and calibration status verified",detail:"Record the instrument identifier and supporting calibration certificate reference."},
{id:"REQ-04",group:"Equipment",title:"Reference artifact and verification records reviewed",detail:"Check traceability evidence and documented verification results where applicable."},
{id:"REQ-05",group:"Execution",title:"Operator competence and authorization reviewed",detail:"Review operator training, authorization, or competence records."},
{id:"REQ-06",group:"Execution",title:"Measurement environment and sample preparation recorded",detail:"Review conditions and evidence relevant to the particular process."},
{id:"REQ-07",group:"Reporting",title:"Measurement result linked to the correct part and specification",detail:"Check part identity, original report, software provenance, and revision control."},
{id:"REQ-08",group:"Reporting",title:"Uncertainty and conformity decision rule documented",detail:"Review the applicable uncertainty statement and agreed decision rule where required."},
];
const blank=():Entry=>({answer:"Not assessed",comment:"",reference:""});
const empty=():AuditRecord=>({answers:{},summary:"",reviewer:""});
export default function AuditWorkspace({audit,onBack,onUpdate,onSaved}:{audit:Audit;onBack:()=>void;onUpdate:(id:string,patch:Partial<Audit>)=>void|Promise<void>;onSaved?:()=>void|Promise<void>}){
const databaseMode=process.env.NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE==="postgres";
const [record,setRecord]=useState<AuditRecord>(empty);
const [saving,setSaving]=useState(false);
const [error,setError]=useState("");
const [ready,setReady]=useState(false);
const [saved,setSaved]=useState(false);
const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
const [projectName,setProjectName]=useState("");
const [availableEquipment,setAvailableEquipment]=useState<Instrument[]>([]);
const [equipmentIds,setEquipmentIds]=useState<string[]>([]);
const [equipmentSaving,setEquipmentSaving]=useState(false);
useEffect(()=>{if(databaseMode){fetch("/api/audits/"+encodeURIComponent(audit.id),{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||"Unable to load checklist");setRecord(d.record);setSnapshot(d.templateSnapshot||null);setProjectName(d.project?.name||"");setEquipmentIds((d.equipment||[]).map((e:Instrument)=>e.id));
fetch("/api/equipment").then(async r=>{if(r.ok){const data=await r.json();setAvailableEquipment(data.equipment||[])}}).catch(()=>{});
setError("");}).catch(e=>setError(String(e))).finally(()=>setReady(true));return;}try{const raw=localStorage.getItem("surface-audit-record:"+audit.id);if(raw){const obj=JSON.parse(raw) as AuditRecord;if(obj&&typeof obj==="object")setRecord({answers:obj.answers||{},summary:obj.summary||"",reviewer:obj.reviewer||""});}}catch{}setReady(true)},[audit.id]);
const checklistItems=snapshot? snapshot.criteria.map(item=>({id:item.code,group:"Template",title:item.text,detail:"Requirement from the selected template revision. Record supporting evidence and observations."})):items;
const assessed=checklistItems.filter(i=>record.answers[i.id]?.answer&&record.answers[i.id]?.answer!=="Not assessed").length;
const nonconforming=checklistItems.filter(i=>record.answers[i.id]?.answer==="Nonconformity").length;
const progress=Math.round(assessed/Math.max(1,checklistItems.length)*100);
useEffect(()=>{if(!ready||databaseMode)return;try{localStorage.setItem("surface-audit-record:"+audit.id,JSON.stringify(record));setSaved(true);}catch{setSaved(false)}},[audit.id,ready,record]);
const update=(id:string,patch:Partial<Entry>)=>{setRecord(current=>({...current,answers:{...current.answers,[id]:{...(current.answers[id]||blank()),...patch}}}));};
const saveRecord=async()=>{if(!databaseMode)return;setSaving(true);setSaved(false);try{const r=await fetch("/api/audits/"+encodeURIComponent(audit.id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({record})});if(!r.ok)throw Error((await r.json()).error||"Save failed");setError("");setSaved(true);await onSaved?.()}catch(e){setError(String(e))}finally{setSaving(false)}};
const saveEquipment=async()=>{
 if(!databaseMode)return;setEquipmentSaving(true);
 try{const r=await fetch("/api/audits/"+encodeURIComponent(audit.id)+"/equipment",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({equipmentIds})});
 if(!r.ok)throw Error((await r.json()).error||"Instrument assignment failed");
 setError("");await onSaved?.();
 }catch(e){setError(String(e))}finally{setEquipmentSaving(false)}
};
const changeStatus=(status:Status)=>onUpdate(audit.id,{status});
const statusMessage=nonconforming>0?"Nonconformities recorded: these require findings and follow-up.":assessed===checklistItems.length?"Checklist assessment completed. Reviewer approval is still required.":"Assessment in progress. Unassessed items remain.";
return <section className="audit-workspace">
<div className="workspace-back"><button type="button" className="linkbtn" onClick={onBack}><ArrowLeft size={16}/> Back to audit register</button></div>
<div className="panel workspace-summary"><div className="workspace-header"><div><p className="eyebrow">{audit.id} · {audit.type}</p><h2>{audit.title}</h2><p className="subtitle">{audit.client} · Target {audit.date}</p></div><label className="workspace-status">Workflow status<select aria-label="Audit workflow status" value={audit.status} onChange={e=>changeStatus(e.target.value as Status)}>{["Scheduled","In progress","In review","Completed"].map(s=><option key={s}>{s}</option>)}</select></label></div>
<div className="workspace-stats"><div><span>Requirements assessed</span><strong>{assessed} / {checklistItems.length}</strong></div><div><span>Checklist progress</span><strong>{progress}%</strong></div><div><span>Nonconformities</span><strong>{nonconforming}</strong></div><div><span>Data state</span><strong>{saved?"Saved locally":"Not yet saved"}</strong></div></div>
<div className="progress workspace-progress"><div style={{width:progress+"%"}}/></div>
<p className="workspace-warning"><Info size={17}/>{statusMessage} Checklist completion does not establish ISO compliance.</p></div>
<div className="workspace-layout"><div className="panel"><div className="panelhead"><div><h2>Measurement assurance checklist</h2><p>{snapshot?"Template: "+snapshot.title+" · frozen revision "+snapshot.revision:"Default demonstration checklist (v0.2)"}</p></div><ClipboardCheck size={19}/></div>
{checklistItems.map((item,i)=>{const answer=record.answers[item.id]||blank();return <div className="requirement" key={item.id}><div className="requirement-header"><div><small>{item.group} · {item.id}</small><h3>{i+1}. {item.title}</h3><p>{item.detail}</p></div><span className={"req-marker "+(answer.answer==="Conforms"?"good":answer.answer==="Nonconformity"?"bad":"")}><CheckCircle2 size={17}/></span></div><div className="assessment-fields"><label>Assessment<select value={answer.answer} aria-label={"Assessment for "+item.id} onChange={e=>update(item.id,{answer:e.target.value as Answer})}>{["Not assessed","Conforms","Nonconformity","Not applicable"].map(o=><option key={o}>{o}</option>)}</select></label><label>Evidence reference<input aria-label={"Evidence reference for "+item.id} placeholder="e.g. Certificate CAL-1042" value={answer.reference} onChange={e=>update(item.id,{reference:e.target.value})}/></label></div><label className="notes-label">Audit observation / rationale<textarea rows={2} aria-label={"Observation for "+item.id} placeholder="Record the observations that support this assessment..." value={answer.comment} onChange={e=>update(item.id,{comment:e.target.value})}/></label></div>})}</div>
<aside className="panel workspace-aside">
{databaseMode&&<div className="assignment-panel">
<h3>Engagement context</h3>
<p>Project: <b>{projectName||"Not linked"}</b></p>
<p>Checklist: <b>{snapshot?snapshot.title+" · rev "+snapshot.revision:"Default demonstration"}</b></p>
<h3>Instruments used</h3>
<p className="registry-info">Select the instruments relevant to this audit. Assignment does not establish calibration validity.</p>
{availableEquipment.length===0?<p className="registry-empty">No instruments registered. Add an instrument under Equipment & Traceability.</p>:<div className="assignment-list">{availableEquipment.map(e=><label key={e.id}><input type="checkbox" checked={equipmentIds.includes(e.id)} onChange={ev=>setEquipmentIds(current=>ev.target.checked?[...current,e.id]:current.filter(id=>id!==e.id))}/><span>{e.identifier} · {e.name}</span></label>)}</div>}
<button className="secondary" type="button" disabled={!ready||equipmentSaving} onClick={saveEquipment}>{equipmentSaving?"Saving…":"Save instrument assignments"}</button>
</div>}
<div className="panelhead"><div><h2>Review notes</h2><p>Working notes · Not an approved report</p></div><FileText size={18}/></div><label className="notes-label">Overall review summary<textarea rows={6} value={record.summary} placeholder="Summarize measurement assurance observations, gaps, and recommended follow-up..." onChange={e=>setRecord(r=>({...r,summary:e.target.value}))}/></label><label className="notes-label">Reviewer / auditor<input value={record.reviewer} placeholder="Name or identifier" onChange={e=>setRecord(r=>({...r,reviewer:e.target.value}))}/></label><div className="review-hint"><ShieldCheck size={18}/><p>{databaseMode?"Development-only PostgreSQL storage. There is no authentication or formal approval control yet. Do not enter confidential customer information.":"These records are stored only in this browser. They are not secure audit evidence, validated compliance decisions, or formal electronic approvals."}</p></div>{error&&<p role="alert" className="storage-error">{error}</p>}{databaseMode&&<button type="button" className="primary save-workspace" disabled={!ready||saving} onClick={saveRecord}><Save size={16}/>{saving?"Saving…":"Save assessment to PostgreSQL"}</button>}<p className="save-status"><Save size={15}/>{databaseMode?(saved?"Saved to development database":"Unsaved changes until you click Save"):(saved?"Changes saved in this browser":"Unable to save browser data")}</p></aside></div></section>}
