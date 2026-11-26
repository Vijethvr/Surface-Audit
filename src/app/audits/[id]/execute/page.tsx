"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";

type Finding={id:string;title:string;severity:string;status:string;actions:Array<{id:string;description:string;owner:string;status:string}>};
type Evidence={id:string;reference:string;description:string|null};
type Asset={id:string;filename:string;sha256:string;sizeBytes:number};
type Item={index:number;code:string;title:string;answer:string;comment:string;reference:string;
 findings:Finding[];evidence:Evidence[];assets:Asset[];ready:boolean;blockers:string[]};
type Board={audit:{id:string;title:string;client:string;status:string;revision:number;type:string;project:{id:string;name:string}|null;
 template:{title:string;revision:string};targetDate:string|null};
 assessment:{summary:string;reviewer:string};items:Item[];
 counts:{total:number;assessed:number;complete:number;nonconforming:number;findings:number;evidenceReferences:number;evidenceFiles:number};
 reportReadiness:{ready:boolean;blockers:string[]};
 scope:{findingTruncated:boolean;evidenceTruncated:boolean;assetTruncated:boolean}};
type FindingInput={title:string;description:string;severity:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL"};
type ActionInput={description:string;owner:string;dueDate:string};
const human=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/^./,s=>s.toUpperCase());
const answers=["Not assessed","Conforms","Nonconformity","Not applicable"] as const;
export default function GuidedExecution({params}:{params:Promise<{id:string}>}){
 const [auditId,setAuditId]=useState("");const [data,setData]=useState<Board|null>(null);
 const [position,setPosition]=useState(0);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);const [editable,setEditable]=useState(false);
 const [answer,setAnswer]=useState<(typeof answers)[number]>("Not assessed");
 const [comment,setComment]=useState("");const [reference,setReference]=useState("");
 const [evidenceEnabled,setEvidenceEnabled]=useState(false);const [evidenceRef,setEvidenceRef]=useState("");
 const [evidenceDescription,setEvidenceDescription]=useState("");
 const [findingEnabled,setFindingEnabled]=useState(false);
 const [finding,setFinding]=useState<FindingInput>({title:"",description:"",severity:"MEDIUM"});
 const [actionEnabled,setActionEnabled]=useState(false);
 const [action,setAction]=useState<ActionInput>({description:"",owner:"",dueDate:""});
 const [tab,setTab]=useState<"work"|"readiness">("work");
 useEffect(()=>{let active=true;void params.then(p=>{if(active)setAuditId(p.id)});return()=>{active=false}},[params]);
 const load=useCallback(async()=>{if(!auditId)return;setBusy(true);setError("");
  try{const response=await fetch("/api/audits/"+encodeURIComponent(auditId)+"/execution",{cache:"no-store"});
   const json=await response.json();if(!response.ok)throw Error(json.error||"Unable to load guided execution");
   setData(json);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load audit")}finally{setBusy(false)}
 },[auditId]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{void fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(v=>setEditable(v.role==="ADMIN"||v.role==="EDITOR")).catch(()=>setEditable(false))},[]);
 const item=data?.items[position];
 useEffect(()=>{if(!item)return;setAnswer(answers.includes(item.answer as typeof answers[number])?item.answer as typeof answers[number]:"Not assessed");
  setComment(item.comment);setReference(item.reference);
  setFindingEnabled(false);setEvidenceEnabled(false);setActionEnabled(false);
  setFinding({title:"",description:"",severity:"MEDIUM"});setAction({description:"",owner:"",dueDate:""});
  setEvidenceRef("");setEvidenceDescription("");setNotice("");
 },[item?.code,item?.answer,item?.comment,item?.reference]);
 const canSave=editable&&data?.audit.status!=="COMPLETED";
 const percent=data?Math.round(data.counts.assessed/Math.max(data.counts.total,1)*100):0;
 const categories=useMemo(()=>({unassessed:data?.items.filter(i=>i.answer==="Not assessed").length??0,
  attention:data?.items.filter(i=>i.blockers.length>0&&i.answer!=="Not assessed").length??0,
  ready:data?.items.filter(i=>i.ready).length??0}),[data]);
 const select=(index:number)=>{setPosition(index);setTab("work");setError("");setNotice("")};
 const save=async(next=false)=>{if(!data||!item)return;setBusy(true);setError("");setNotice("");
  try{
   const response=await fetch("/api/audits/"+encodeURIComponent(auditId)+"/execution/step",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({expectedRevision:data.audit.revision,requirementCode:item.code,
     answer,comment,reference,
     evidence:evidenceEnabled?{reference:evidenceRef,description:evidenceDescription}:null,
     finding:answer==="Nonconformity"&&findingEnabled?finding:null,
     action:answer==="Nonconformity"&&findingEnabled&&actionEnabled?{...action,dueDate:action.dueDate||null}:null})});
   const result=await response.json();
   if(!response.ok){const issue=result.issues?.formErrors?.join("; ");throw Error((result.error??"Save failed")+(issue?": "+issue:""))}
   await load();setNotice(item.code+" saved to the audit and event history.");
   if(next&&position<(data.items.length-1))setPosition(position+1);
  }catch(e){setError(e instanceof Error?e.message:"Unable to save requirement")}finally{setBusy(false)}
 };
 return <main className="guided-page">
  <header className="guided-header"><div><Link href={"/?audit="+encodeURIComponent(auditId)} className="management-return">Back to audit workspace</Link>
   <p className="eyebrow">METHOD-LED ASSURANCE · GUIDED EXECUTION</p><h1>{data?.audit.title??"Guided audit execution"}</h1>
   <p>{data?.audit.client??"Client"} · {data?.audit.template.title??"Audit"} · revision {data?.audit.template.revision??"—"}</p></div>
   <div className="guided-actions no-print"><Link href={"/reports/"+encodeURIComponent(auditId)}>Open assessment report</Link>
    <button type="button" className="secondary" onClick={()=>void load()} disabled={busy}>Refresh from database</button></div>
  </header>
  <div className="storage-banner">Local-development assessment, not an independent conformity or accreditation decision. Review evidence authenticity and use independent approval before sealing.</div>
  {error&&<p className="storage-error" role="alert">{error} {error.toLowerCase().includes("changed")&&<button type="button" className="secondary" onClick={()=>void load()}>Reload latest</button>}</p>}
  {notice&&<p className="storage-banner" role="status">{notice}</p>}
  {busy&&<p role="status" className="storage-banner">Synchronizing current assessment…</p>}
  {data&&<>
   <section className="guided-score">
    <div><span>Requirements assessed</span><strong>{data.counts.assessed}/{data.counts.total}</strong></div>
    <div><span>Requirement checks complete</span><strong>{data.counts.complete}</strong></div>
    <div><span>Needs attention</span><strong>{categories.attention}</strong></div>
    <div><span>Nonconformities</span><strong>{data.counts.nonconforming}</strong></div>
    <div><span>Evidence files</span><strong>{data.counts.evidenceFiles}</strong></div>
   </section>
   <div className="guided-progress"><div style={{width:percent+"%"}}/></div>
   <nav className="guided-tabs no-print" aria-label="Execution views">
    <button type="button" className={tab==="work"?"active":""} onClick={()=>setTab("work")}>Assessment steps</button>
    <button type="button" className={tab==="readiness"?"active":""} onClick={()=>setTab("readiness")}>Report readiness ({data.reportReadiness.blockers.length})</button>
   </nav>
   {tab==="work"&&<div className="guided-layout">
    <aside className="guided-index"><h2>Requirement navigator</h2><p>{categories.unassessed} not assessed · {categories.ready} complete</p>
     {data.items.map((req,i)=><button key={req.code} type="button" onClick={()=>select(i)} className={"guided-index-item "+(position===i?"selected":"")}>
      <span className={"guided-dot "+(req.ready?"ready":req.answer==="Not assessed"?"pending":"attention")}>{i+1}</span>
      <span><strong>{req.code}</strong><small>{req.title}</small></span></button>)}
    </aside>
    <section className="guided-editor">
     {item&&<><div className="guided-step-title"><div><p className="eyebrow">STEP {position+1} OF {data.items.length} · {item.code}</p>
      <h2>{item.title}</h2><p>{item.ready?"Requirement checks satisfied in current records.":"Complete the assessment and supporting evidence below."}</p></div>
      <span className={"guided-status "+(item.ready?"complete":"")}>{item.ready?"Ready":"Needs work"}</span></div>
     {item.blockers.length>0&&<div className="guided-blockers"><strong>Requirement issues</strong><ul>{item.blockers.map(b=><li key={b}>{b}</li>)}</ul></div>}
     <div className="guided-form">
      <label>Technical assessment<select value={answer} disabled={!canSave||busy} onChange={e=>setAnswer(e.target.value as typeof answers[number])}>
       {answers.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Observation and technical rationale<textarea rows={4} maxLength={4000} disabled={!canSave||busy} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Describe the procedure, record reviewed, acceptance criterion, measurement observation and limitations."/></label>
      <label>Supporting evidence identifier<input maxLength={500} disabled={!canSave||busy} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Certificate, report or drawing revision"/></label>
      <label className="guided-check"><input type="checkbox" disabled={!canSave||busy||answer==="Not assessed"} checked={evidenceEnabled} onChange={e=>setEvidenceEnabled(e.target.checked)}/> Add a separately indexed evidence reference</label>
      {evidenceEnabled&&<div className="guided-subform"><label>Evidence reference<input value={evidenceRef} maxLength={500} onChange={e=>setEvidenceRef(e.target.value)} placeholder="CAL-2026-123"/></label>
       <label>Description<input value={evidenceDescription} maxLength={1000} onChange={e=>setEvidenceDescription(e.target.value)}/></label></div>}
      {answer==="Nonconformity"&&<><div className="guided-alert">Nonconformities require a structured finding. You can create one here together with an initial CAPA, or use an existing finding shown below.</div>
       <label className="guided-check"><input type="checkbox" disabled={!canSave||busy} checked={findingEnabled} onChange={e=>{setFindingEnabled(e.target.checked);if(!e.target.checked)setActionEnabled(false)}}/> Register a new finding</label>
       {findingEnabled&&<div className="guided-subform"><label>Finding title<input value={finding.title} maxLength={200} onChange={e=>setFinding(f=>({...f,title:e.target.value}))}/></label>
        <label>Observed condition<textarea rows={3} value={finding.description} maxLength={4000} onChange={e=>setFinding(f=>({...f,description:e.target.value}))}/></label>
        <label>Severity<select value={finding.severity} onChange={e=>setFinding(f=>({...f,severity:e.target.value as FindingInput["severity"]}))}>
         {(["LOW","MEDIUM","HIGH","CRITICAL"] as const).map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="guided-check"><input type="checkbox" checked={actionEnabled} onChange={e=>setActionEnabled(e.target.checked)}/> Assign initial corrective action with finding</label>
        {actionEnabled&&<div className="guided-subform"><label>Corrective action<textarea value={action.description} rows={2} onChange={e=>setAction(a=>({...a,description:e.target.value}))}/></label>
         <label>Action owner<input maxLength={160} value={action.owner} onChange={e=>setAction(a=>({...a,owner:e.target.value}))}/></label>
         <label>Due date<input type="date" value={action.dueDate} onChange={e=>setAction(a=>({...a,dueDate:e.target.value}))}/></label></div>}
       </div>}</>}
     </div>
     <div className="guided-step-actions no-print">
      <button type="button" className="secondary" disabled={position===0} onClick={()=>select(position-1)}>Previous requirement</button>
      {canSave&&<><button type="button" className="secondary" disabled={busy} onClick={()=>void save(false)}>Save requirement</button>
       <button type="button" className="primary" disabled={busy} onClick={()=>void save(true)}>Save &amp; next</button></>}
      {!canSave&&<p>Assessment editing is unavailable for this role or sealed audit.</p>}
      {position<data.items.length-1&&<button type="button" className="secondary" onClick={()=>select(position+1)}>Skip to next</button>}
     </div>
     <div className="guided-associated"><h3>Existing evidence and corrective actions · {item.code}</h3>
      {item.evidence.map(e=><p key={e.id}><strong>Reference:</strong> {e.reference} {e.description}</p>)}
      {item.assets.map(a=><p key={a.id}><strong>File:</strong> {a.filename} · {a.sizeBytes} B · SHA-256 {a.sha256.slice(0,16)}…
       <a href={"/api/audits/"+encodeURIComponent(auditId)+"/assets/"+encodeURIComponent(a.id)}>Open file</a></p>)}
      {item.findings.map(f=><div className="guided-associated-finding" key={f.id}><strong>{f.title}</strong> · {human(f.severity)} · {human(f.status)}
       {f.actions.map(a=><p key={a.id}>{a.description} · {a.owner} · {human(a.status)}</p>)}</div>)}
      {!item.findings.length&&!item.evidence.length&&!item.assets.length&&<p>Nothing linked to this requirement yet.</p>}
     </div>
    </>}
    </section>
   </div>}
   {tab==="readiness"&&<section className="guided-readiness"><h2>Pre-review report readiness</h2>
    <p>{data.reportReadiness.ready?"All report content checks currently pass. Independent review is still required before sealing.":
     data.reportReadiness.blockers.length+" report content blockers remain in the saved records."}</p>
    <div className="guided-readiness-grid"><div><strong>Requirement assessment</strong>
     {data.items.filter(i=>!i.ready).map(i=><button type="button" key={i.code} onClick={()=>select(i)}>
      {i.code}: {i.blockers.join(", ")}</button>)}
     {data.items.every(i=>i.ready)&&<p>All individual requirement checks have supporting records.</p>}</div>
     <div><strong>Overall report checks</strong><ul>{data.reportReadiness.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>
      {data.reportReadiness.blockers.length===0&&<p>No content blockers from the current report.</p>}</div></div>
    <p>Use the original <Link href={"/?audit="+encodeURIComponent(auditId)}>audit workspace</Link> to edit the overall summary and reviewer identifier, manage finding closure, and request independent review.</p>
    <Link className="primary" href={"/reports/"+encodeURIComponent(auditId)}>Open draft report</Link>
   </section>}
   {(data.scope.findingTruncated||data.scope.evidenceTruncated||data.scope.assetTruncated)&&<p className="management-warning">Linked item lists are truncated. Use original audit registers to inspect complete records before interpreting readiness.</p>}
   <footer className="management-footer">Changes use version-checked transactional writes and append to the audit event log. Saving a step does not approve or seal an audit. Reviewer and viewer accounts have read-only access.</footer>
  </>}
 </main>;
}
