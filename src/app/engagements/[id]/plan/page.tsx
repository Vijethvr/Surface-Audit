"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";

type Milestone={id:string;title:string;owner:string;dueDate:string|null;status:"PLANNED"|"IN_PROGRESS"|"DONE";note:string};
type Deliverable={id:string;title:string;description:string;auditId:string|null;dueDate:string|null;status:"PLANNED"|"PREPARING"|"SUBMITTED"|"ACCEPTED";acceptanceNote:string;acceptedBy:string};
type Plan={revision:number;objective:string;scope:string;exclusions:string;commercialNote:string;stage:"PROPOSED"|"SCOPED"|"DELIVERING"|"READY_FOR_HANDOFF"|"CLOSED";milestones:Milestone[];deliverables:Deliverable[]};
type Payload={project:{id:string;name:string;reference:string|null;client:{name:string};audits:Array<{id:string;title:string;status:string;reportSnapshot:{id:string}|null}>;auditCount:number;auditsTruncated:boolean};plan:Plan;history:Array<{id:string;revision:number;actor:string;action:string;summary:string;createdAt:string}>};
const stages=["PROPOSED","SCOPED","DELIVERING","READY_FOR_HANDOFF","CLOSED"] as const;
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/^./,c=>c.toUpperCase());
const shortDate=(s:string|null)=>s?new Date(s+"T00:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}):"Not set";
export default function ProjectLifecycle({params}:{params:Promise<{id:string}>}){
 const [id,setId]=useState("");
 const [data,setData]=useState<Payload|null>(null);const [plan,setPlan]=useState<Plan|null>(null);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 const [canEdit,setCanEdit]=useState(false);const [summary,setSummary]=useState("");
 useEffect(()=>{let active=true;void params.then(p=>{if(active)setId(p.id)});return()=>{active=false}},[params]);
 const refresh=useCallback(async()=>{if(!id)return;setBusy(true);setError("");
  try{const r=await fetch("/api/projects/"+encodeURIComponent(id)+"/lifecycle",{cache:"no-store"});const v=await r.json();if(!r.ok)throw Error(v.error||"Unable to load project plan");
   setData(v);setPlan(v.plan)}catch(e){setError(e instanceof Error?e.message:"Unable to load project plan")}finally{setBusy(false)}
 },[id]);
 useEffect(()=>{void refresh()},[refresh]);
 useEffect(()=>{void fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(v=>setCanEdit(v.role==="ADMIN"||v.role==="EDITOR")).catch(()=>setCanEdit(false))},[]);
 const update=(change:Partial<Plan>)=>setPlan(old=>old?{...old,...change}:old);
 const addMilestone=()=>update({milestones:[...(plan?.milestones??[]),{id:crypto.randomUUID(),title:"New delivery milestone",owner:"",dueDate:null,status:"PLANNED",note:""}]});
 const addDeliverable=()=>update({deliverables:[...(plan?.deliverables??[]),{id:crypto.randomUUID(),title:"New client deliverable",description:"",auditId:null,dueDate:null,status:"PLANNED",acceptanceNote:"",acceptedBy:""}]});
 const editMilestone=(id:string,value:Partial<Milestone>)=>update({milestones:plan?.milestones.map(m=>m.id===id?{...m,...value}:m)});
 const editDeliverable=(id:string,value:Partial<Deliverable>)=>update({deliverables:plan?.deliverables.map(d=>d.id===id?{...d,...value}:d)});
 const blockers=useMemo(()=>{if(!plan)return[];const out:string[]=[];
  if(!plan.objective.trim())out.push("Define the engagement objective");if(!plan.scope.trim())out.push("Define the agreed delivery scope");
  if(!plan.milestones.length)out.push("Add delivery milestones");
  if(plan.milestones.some(m=>m.status!=="DONE"))out.push("Complete every milestone");
  if(!plan.deliverables.length)out.push("Register expected deliverables");
  if(plan.deliverables.some(d=>d.status!=="ACCEPTED"))out.push("Record internal acceptance for every deliverable");
  return out},[plan]);
 const save=async()=>{if(!plan||!id)return;setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/api/projects/"+encodeURIComponent(id)+"/lifecycle",{method:"PATCH",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({...plan,expectedRevision:plan.revision,summary:summary.trim()||"Updated consulting engagement lifecycle"})});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Save failed");setNotice("Saved revision "+v.revision+".");setSummary("");await refresh()
  }catch(e){setError(e instanceof Error?e.message:"Unable to save lifecycle")}finally{setBusy(false)}
 };
 const editable=canEdit&&plan?.stage!=="CLOSED";
 return <main className="lc-page">
  <header className="lc-header"><div><Link href="/engagements" className="management-return">Engagement Studio</Link>
   <p className="eyebrow">CONSULTING ENGAGEMENT · PROJECT DELIVERY</p><h1>{data?.project.name??"Engagement lifecycle"}</h1>
   <p>{data?.project.client.name??"Client"}{data?.project.reference?" · "+data.project.reference:""}</p></div>
   <div className="lc-actions no-print"><button className="secondary" type="button" onClick={()=>void refresh()} disabled={busy}>Reload</button>
    <button className="secondary" type="button" onClick={()=>window.print()} disabled={!data}>Print lifecycle pack</button>
    {editable&&<button className="primary" type="button" disabled={busy} onClick={()=>void save()}>Save project plan</button>}</div>
  </header>
  <div className="storage-banner">Internal local-development delivery planning. Acceptance is an operator-recorded acknowledgement, not a client's authenticated approval or legal signature.</div>
  {error&&<p className="storage-error" role="alert">{error}</p>}
  {notice&&<p className="storage-banner" role="status">{notice}</p>}
  {busy&&<p className="storage-banner" role="status">Synchronizing project lifecycle…</p>}
  {data&&plan&&<>
   <section className="lc-pulse">
    <div><span>Plan revision</span><strong>{plan.revision}</strong></div>
    <div><span>Milestones completed</span><strong>{plan.milestones.filter(m=>m.status==="DONE").length}/{plan.milestones.length}</strong></div>
    <div><span>Internally accepted deliverables</span><strong>{plan.deliverables.filter(d=>d.status==="ACCEPTED").length}/{plan.deliverables.length}</strong></div>
    <div><span>Audits in project</span><strong>{data.project.auditCount}</strong></div>
   </section>
   <section className="lc-panel"><div className="lc-heading"><h2>Engagement definition</h2><span>Scope, exclusions and commercial assumptions</span></div>
    <div className="lc-fields">
     <label>Lifecycle stage<select disabled={!editable} value={plan.stage} onChange={e=>update({stage:e.target.value as Plan["stage"]})}>{stages.map(s=><option value={s} key={s}>{label(s)}</option>)}</select></label>
     <label>Objective<textarea disabled={!editable} maxLength={3000} rows={3} value={plan.objective} onChange={e=>update({objective:e.target.value})} placeholder="Client's desired measurement-assurance outcome"/></label>
     <label>In-scope services<textarea disabled={!editable} maxLength={6000} rows={4} value={plan.scope} onChange={e=>update({scope:e.target.value})} placeholder="Audits, calibration checks, traceability review, required reports…"/></label>
     <label>Exclusions / out-of-scope<textarea disabled={!editable} maxLength={3000} rows={3} value={plan.exclusions} onChange={e=>update({exclusions:e.target.value})}/></label>
     <label>Commercial assumptions and quotation reference<textarea disabled={!editable} maxLength={3000} rows={3} value={plan.commercialNote} onChange={e=>update({commercialNote:e.target.value})} placeholder="Reference only; no payment or billing processing"/></label>
    </div>
   </section>
   <section className="lc-panel"><div className="lc-heading"><div><h2>Delivery milestones</h2><p>Named owners, due dates, progress, and execution notes.</p></div>
    {editable&&<button type="button" className="secondary no-print" onClick={addMilestone}>+ Milestone</button>}</div>
    {plan.milestones.map(m=><article className="lc-item" key={m.id}><div className="lc-item-grid">
     <label>Milestone<input disabled={!editable} maxLength={180} value={m.title} onChange={e=>editMilestone(m.id,{title:e.target.value})}/></label>
     <label>Owner<input disabled={!editable} maxLength={120} value={m.owner} onChange={e=>editMilestone(m.id,{owner:e.target.value})}/></label>
     <label>Due date<input disabled={!editable} type="date" value={m.dueDate??""} onChange={e=>editMilestone(m.id,{dueDate:e.target.value||null})}/></label>
     <label>Status<select disabled={!editable} value={m.status} onChange={e=>editMilestone(m.id,{status:e.target.value as Milestone["status"]})}>
      <option value="PLANNED">Planned</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select></label>
    </div><label className="lc-full-label">Execution note<input disabled={!editable} maxLength={2000} value={m.note} onChange={e=>editMilestone(m.id,{note:e.target.value})}/></label>
    {editable&&<button type="button" className="lc-remove no-print" onClick={()=>update({milestones:plan.milestones.filter(x=>x.id!==m.id)})}>Remove milestone</button>}</article>)}
    {!plan.milestones.length&&<p>No milestones yet. Add the major stages of delivery.</p>}
   </section>
   <section className="lc-panel"><div className="lc-heading"><div><h2>Client deliverables and internal acceptance</h2><p>Link outputs to actual audit records. An audit-linked item requires a completed, sealed report before acceptance.</p></div>
    {editable&&<button className="secondary no-print" type="button" onClick={addDeliverable}>+ Deliverable</button>}</div>
    {plan.deliverables.map(d=><article key={d.id} className="lc-item"><div className="lc-item-grid">
     <label>Deliverable title<input disabled={!editable} maxLength={180} value={d.title} onChange={e=>editDeliverable(d.id,{title:e.target.value})}/></label>
     <label>Related audit<select disabled={!editable} value={d.auditId??""} onChange={e=>editDeliverable(d.id,{auditId:e.target.value||null})}>
      <option value="">Independent project deliverable</option>{data.project.audits.map(a=><option key={a.id} value={a.id}>{a.title} · {a.reportSnapshot?"sealed":"draft"}</option>)}</select></label>
     <label>Due date<input disabled={!editable} type="date" value={d.dueDate??""} onChange={e=>editDeliverable(d.id,{dueDate:e.target.value||null})}/></label>
     <label>Status<select disabled={!editable} value={d.status} onChange={e=>editDeliverable(d.id,{status:e.target.value as Deliverable["status"],
      ...(e.target.value==="ACCEPTED"?{}:{acceptanceNote:"",acceptedBy:""})})}>
      {(["PLANNED","PREPARING","SUBMITTED","ACCEPTED"] as const).map(x=><option value={x} key={x}>{label(x)}</option>)}</select></label>
    </div><label className="lc-full-label">Output description<textarea disabled={!editable} maxLength={2000} rows={2} value={d.description} onChange={e=>editDeliverable(d.id,{description:e.target.value})}/></label>
    {d.status==="ACCEPTED"&&<div className="lc-acceptance"><label>Recorded by<input disabled={!editable} maxLength={120} value={d.acceptedBy} onChange={e=>editDeliverable(d.id,{acceptedBy:e.target.value})}/></label>
     <label>Internal acceptance rationale<textarea disabled={!editable} rows={2} maxLength={2000} value={d.acceptanceNote} onChange={e=>editDeliverable(d.id,{acceptanceNote:e.target.value})}/></label></div>}
    {d.auditId&&<Link href={"/reports/"+encodeURIComponent(d.auditId)}>Open related audit report</Link>}
    {editable&&<button type="button" className="lc-remove no-print" onClick={()=>update({deliverables:plan.deliverables.filter(x=>x.id!==d.id)})}>Remove deliverable</button>}</article>)}
    {!plan.deliverables.length&&<p>No deliverables registered. Add contractual or internal outputs and monitor handoff.</p>}
    {data.project.auditsTruncated&&<p className="management-warning">Audit selector includes only 250 recent records; project has {data.project.auditCount} audits.</p>}
   </section>
   <section className="lc-panel"><h2>Handoff and closure readiness</h2>{blockers.length===0?<p>All internal lifecycle prerequisites are recorded. Review the evidence and acceptance notes before closing.</p>:
    <ul>{blockers.map(b=><li key={b}>{b}</li>)}</ul>}
    <p className="lc-footnote">These are field-completeness checks only, not contractual client acceptance, conformity verification, financial approval, or a digital signature.</p>
    <label className="lc-full-label no-print">Change-log reason<input disabled={!editable} maxLength={500} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="What changed, why, and which decision was recorded?"/></label>
    {editable&&<button type="button" className="primary no-print" disabled={busy} onClick={()=>void save()}>Save lifecycle revision</button>}
   </section>
   <section className="lc-panel"><h2>Version and decision history</h2>
    <div className="ops-table-wrap"><table><thead><tr><th>Revision</th><th>Activity</th><th>Operator</th><th>Decision summary</th><th>When</th></tr></thead><tbody>
     {data.history.map(e=><tr key={e.id}><td>v{e.revision}</td><td>{label(e.action)}</td><td>{e.actor}</td><td>{e.summary}</td><td>{new Date(e.createdAt).toLocaleString("en-GB")}</td></tr>)}</tbody></table></div>
    {!data.history.length&&<p>First save will create the initial version history record.</p>}
    {data.history.length===100&&<p className="management-warning">History displays the 100 most recent revisions only.</p>}
   </section>
   <footer className="management-footer">SURFACE Audit · Local-development project lifecycle · Internal acceptance only · Report is not a signed contract or accredited assurance conclusion.</footer>
  </>}
 </main>
}
