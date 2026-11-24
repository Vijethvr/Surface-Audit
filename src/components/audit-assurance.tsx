"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {AlertTriangle,ClipboardCheck,FileCheck2,RefreshCw} from "lucide-react";

type Requirement={id:string;title:string};
type Action={id:string;description:string;owner:string;dueDate:string|null;status:"OPEN"|"IN_PROGRESS"|"COMPLETED"|"VERIFIED";closureEvidence:string|null;verifiedBy:string|null};
type Finding={id:string;requirementCode:string;title:string;description:string;severity:"LOW"|"MEDIUM"|"HIGH"|"CRITICAL";status:"OPEN"|"ACTION_IN_PROGRESS"|"READY_FOR_VERIFICATION"|"CLOSED";actions:Action[]};
type Evidence={id:string;requirementCode:string;reference:string;description:string|null};
const statuses:Finding["status"][]=["OPEN","ACTION_IN_PROGRESS","READY_FOR_VERIFICATION","CLOSED"];
const actionStatuses:Action["status"][]=["OPEN","IN_PROGRESS","COMPLETED","VERIFIED"];
function readable(text:string){return text.toLowerCase().replaceAll("_"," ").replace(/^./,v=>v.toUpperCase())}

export default function AuditAssurance({auditId,requirements}:{auditId:string;requirements:Requirement[]}){
 const [findings,setFindings]=useState<Finding[]>([]);
 const [evidence,setEvidence]=useState<Evidence[]>([]);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [requirementCode,setRequirementCode]=useState("");
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [severity,setSeverity]=useState<Finding["severity"]>("MEDIUM");
 const [reference,setReference]=useState("");
 const [evidenceDescription,setEvidenceDescription]=useState("");
 const [actionFindingId,setActionFindingId]=useState("");
 const [actionDescription,setActionDescription]=useState("");
 const [owner,setOwner]=useState("");
 const [dueDate,setDueDate]=useState("");
 const [closureEvidence,setClosureEvidence]=useState<Record<string,string>>({});
 const [verifier,setVerifier]=useState<Record<string,string>>({});
 const code=requirementCode||requirements[0]?.id||"";

 const fetchJson=useCallback(async(path:string,options?:RequestInit)=>{
  const response=await fetch("/api/audits/"+encodeURIComponent(auditId)+path,{cache:"no-store",...options});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||"Request failed");
  return result;
 },[auditId]);
 const refresh=useCallback(async()=>{
  try{
   const [f,e]=await Promise.all([fetchJson("/findings"),fetchJson("/evidence")]);
   setFindings(f.findings);setEvidence(e.evidence);setError("");
  }catch(err){setError(err instanceof Error?err.message:"Unable to load assurance records")}
 },[fetchJson]);
 useEffect(()=>{void refresh()},[refresh]);
 const post=(path:string,body:unknown,method="POST")=>fetchJson(path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 async function perform(task:()=>Promise<unknown>,success:string){
  setBusy(true);setError("");setMessage("");
  try{await task();await refresh();setMessage(success)}
  catch(err){setError(err instanceof Error?err.message:"Unable to save")}
  finally{setBusy(false)}
 }
 const submitFinding=(e:FormEvent)=>{e.preventDefault();void perform(async()=>{
  await post("/findings",{requirementCode:code,title,description,severity});
  setTitle("");setDescription("");
 },"Finding added to the audit.")};
 const submitEvidence=(e:FormEvent)=>{e.preventDefault();void perform(async()=>{
  await post("/evidence",{requirementCode:code,reference,description:evidenceDescription});
  setReference("");setEvidenceDescription("");
 },"Evidence reference recorded.")};
 const submitAction=(e:FormEvent)=>{e.preventDefault();void perform(async()=>{
  await post("/findings/"+encodeURIComponent(actionFindingId)+"/actions",{description:actionDescription,owner,dueDate:dueDate||null});
  setActionDescription("");setOwner("");setDueDate("");
 },"Corrective action assigned.")};
 const setFindingStatus=(finding:Finding,status:Finding["status"])=>void perform(
  ()=>post("/findings/"+encodeURIComponent(finding.id),{status},"PATCH"),
  "Finding status updated."
 );
 const setActionStatus=(finding:Finding,action:Action,status:Action["status"])=>void perform(
  ()=>post("/findings/"+encodeURIComponent(finding.id)+"/actions/"+encodeURIComponent(action.id),{
   status,closureEvidence:closureEvidence[action.id]??action.closureEvidence??"",verifiedBy:verifier[action.id]??action.verifiedBy??""
  },"PATCH"),"Corrective action updated."
 );
 return <div className="panel assurance-workflow">
  <div className="panelhead"><div><h2>Findings, CAPA & evidence references</h2><p>Structured requirement links · development records, not approved evidence</p></div><button className="secondary" type="button" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={15}/> Refresh</button></div>
  {error&&<p className="storage-error" role="alert">{error}</p>}
  {message&&<p className="storage-banner" role="status">{message}</p>}
  <div className="assurance-forms">
   <form onSubmit={submitFinding}>
    <h3><AlertTriangle size={17}/> Record finding</h3>
    <label>Requirement<select value={code} onChange={e=>setRequirementCode(e.target.value)} required>{requirements.map(r=><option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}</select></label>
    <label>Finding title<input required minLength={2} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Missing calibration verification record"/></label>
    <label>Observed condition<textarea required minLength={2} maxLength={4000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <label>Severity<select value={severity} onChange={e=>setSeverity(e.target.value as Finding["severity"])}>{["LOW","MEDIUM","HIGH","CRITICAL"].map(s=><option key={s}>{s}</option>)}</select></label>
    <button className="primary" type="submit" disabled={busy||!code}>Add finding</button>
   </form>
   <form onSubmit={submitEvidence}>
    <h3><FileCheck2 size={17}/> Reference evidence</h3>
    <p>Register a document ID or certificate reference. No file is uploaded or verified.</p>
    <label>Requirement<select value={code} onChange={e=>setRequirementCode(e.target.value)} required>{requirements.map(r=><option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}</select></label>
    <label>Reference identifier<input required minLength={2} maxLength={500} value={reference} onChange={e=>setReference(e.target.value)} placeholder="CAL-2026-0102"/></label>
    <label>Description<input maxLength={1000} value={evidenceDescription} onChange={e=>setEvidenceDescription(e.target.value)} placeholder="Calibration certificate identifier"/></label>
    <button className="secondary" type="submit" disabled={busy||!code}>Add reference</button>
   </form>
   <form onSubmit={submitAction}>
    <h3><ClipboardCheck size={17}/> Assign corrective action</h3>
    <label>Finding<select required value={actionFindingId} onChange={e=>setActionFindingId(e.target.value)}><option value="">Select an open finding</option>{findings.filter(f=>f.status!=="CLOSED").map(f=><option key={f.id} value={f.id}>{f.requirementCode} · {f.title}</option>)}</select></label>
    <label>Action description<textarea rows={3} minLength={3} maxLength={2000} required value={actionDescription} onChange={e=>setActionDescription(e.target.value)}/></label>
    <label>Responsible owner<input required minLength={2} maxLength={160} value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Owner or reviewer identifier"/></label>
    <label>Target date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={busy||!actionFindingId}>Assign action</button>
   </form>
  </div>
  <div className="assurance-records">
   <h3>Audit findings ({findings.length})</h3>
   {findings.length===0?<p className="registry-empty">No findings recorded for this audit.</p>:findings.map(f=><article key={f.id}>
    <div className="assurance-record-head"><div><b>{f.requirementCode} · {f.title}</b><p>{f.description}</p><small>{f.severity} severity</small></div>
    <label>Status<select disabled={busy} value={f.status} onChange={e=>setFindingStatus(f,e.target.value as Finding["status"])}>{statuses.map(st=><option key={st} value={st}>{readable(st)}</option>)}</select></label></div>
    {f.actions.map(a=><div className="assurance-action" key={a.id}><b>{a.description}</b><small>Owner: {a.owner} · Due {a.dueDate?new Date(a.dueDate).toLocaleDateString("en-GB"):"not specified"}</small>
      <div className="assurance-action-fields"><label>Action status<select disabled={busy||f.status==="CLOSED"} value={a.status} onChange={e=>setActionStatus(f,a,e.target.value as Action["status"])}>{actionStatuses.map(st=><option key={st} value={st}>{readable(st)}</option>)}</select></label>
      <label>Closure evidence<input maxLength={500} value={closureEvidence[a.id]??a.closureEvidence??""} onChange={e=>setClosureEvidence(state=>({...state,[a.id]:e.target.value}))} placeholder="Evidence document reference"/></label>
      <label>Verified by<input maxLength={160} value={verifier[a.id]??a.verifiedBy??""} onChange={e=>setVerifier(state=>({...state,[a.id]:e.target.value}))} placeholder="Verifier identifier"/></label>
      <button type="button" className="secondary" disabled={busy||f.status==="CLOSED"} onClick={()=>setActionStatus(f,a,a.status)}>Save details</button>
      </div></div>)}
    <small className="assurance-guard">A finding can be closed only after at least one action is verified, and every action has verification details.</small>
   </article>)}
   <h3>Evidence references ({evidence.length})</h3>
   {evidence.length===0?<p className="registry-empty">No evidence references added.</p>:<div className="registry-items">{evidence.map(e=><article key={e.id}><b>{e.requirementCode} · {e.reference}</b><small>{e.description||"Reference only — not an uploaded or approved document"}</small></article>)}</div>}
  </div>
 </div>
}
