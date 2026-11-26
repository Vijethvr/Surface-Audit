"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
type Requirement={code:string;text:string};
type AuditSpec={key:string;title:string;type:string;offsetDays:number|null;criteria:Requirement[]};
type Blueprint={objective:string;scope:string;exclusions:string;
 milestones:Array<{title:string;owner:string;offsetDays:number|null;note:string}>;
 audits:AuditSpec[];
 deliverables:Array<{title:string;description:string;auditKey:string|null;offsetDays:number|null}>};
type Methodology={id:string;title:string;description:string;revision:string;blueprint:Blueprint;builtin:boolean};
type Client={id:string;name:string};
const today=new Date().toISOString().slice(0,10);
function formError(body:{error?:string;issues?:{formErrors?:string[];fieldErrors?:Record<string,string[]>}}){
 const issues=body.issues?.fieldErrors;
 return [body.error??"Request failed",...Object.entries(issues??{}).flatMap(([field,items])=>items.map(item=>field+": "+item))].join(" · ");
}
export default function MethodologyWorkbench(){
 const [methods,setMethods]=useState<Methodology[]>([]);const [clients,setClients]=useState<Client[]>([]);
 const [selected,setSelected]=useState("");const [clientId,setClientId]=useState("");
 const [projectName,setProjectName]=useState("");const [reference,setReference]=useState("");
 const [startDate,setStartDate]=useState(today);const [owner,setOwner]=useState("");
 const [customTitle,setCustomTitle]=useState("");const [customDescription,setCustomDescription]=useState("");
 const [revision,setRevision]=useState("1.0");const [blueprintJson,setBlueprintJson]=useState("");
 const [tab,setTab]=useState<"create"|"custom">("create");const [error,setError]=useState("");const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);const [result,setResult]=useState<{projectId:string;planUrl:string;packUrl:string;auditIds:string[];milestoneCount:number;deliverableCount:number}|null>(null);
 const refresh=async()=>{try{
  const [m,c]=await Promise.all([fetch("/api/methodologies",{cache:"no-store"}),fetch("/api/clients",{cache:"no-store"})]);
  const [mr,cr]=await Promise.all([m.json(),c.json()]);if(!m.ok||!c.ok)throw Error(mr.error||cr.error||"Unable to load data");
  setMethods(mr.methodologies);setClients(cr.clients);
  setSelected(value=>mr.methodologies.some((x:Methodology)=>x.id===value)?value:mr.methodologies[0]?.id??"");
 }catch(e){setError(e instanceof Error?e.message:"Unable to load methodologies")}};
 useEffect(()=>{void refresh()},[]);
 const method=useMemo(()=>methods.find(x=>x.id===selected),[methods,selected]);
 const duplicate=()=>{if(!method)return;setTab("custom");setCustomTitle(method.title+" — Custom");
  setCustomDescription(method.description);setRevision("1.0");setBlueprintJson(JSON.stringify(method.blueprint,null,2));
  setMessage("Edit the copied blueprint and save it as a reusable custom methodology. Existing projects never change.")};
 const apply=async()=>{if(!method||!clientId||!projectName.trim())return;setBusy(true);setError("");setMessage("");setResult(null);
  try{const r=await fetch("/api/methodologies/apply",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({methodologyId:method.id,clientId,projectName,reference,startDate,owner})});
   const body=await r.json();if(!r.ok)throw Error(formError(body));
   setResult(body);setMessage("Created project, scoped lifecycle, "+body.auditIds.length+" audits, "+body.milestoneCount+" milestones and "+body.deliverableCount+" deliverables in one operation.");
  }catch(e){setError(e instanceof Error?e.message:"Methodology application failed")}finally{setBusy(false)}};
 const saveCustom=async()=>{setBusy(true);setError("");setMessage("");
  try{const parsed=JSON.parse(blueprintJson);
   const r=await fetch("/api/methodologies",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({title:customTitle,description:customDescription,revision,blueprint:parsed})});
   const body=await r.json();if(!r.ok)throw Error(formError(body));
   await refresh();setSelected(body.methodology.id);setTab("create");setMessage("Reusable custom methodology published. You can now apply it to client engagements.");
  }catch(e){setError(e instanceof Error?e.message:"Invalid JSON or methodology")}finally{setBusy(false)}};
 return <main className="method-page">
  <header className="method-header"><div><Link className="management-return" href="/">SURFACE Audit · Workspace</Link>
   <p className="eyebrow">CONSULTING SERVICE DESIGN · REPEATABLE DELIVERY</p>
   <h1>Methodology Workbench</h1><p>Turn a repeatable service into a scoped project, frozen audit checklists, milestones and client deliverables.</p></div>
   <div className="method-nav"><Link href="/engagements">Engagement Studio</Link><Link href="/delivery">Delivery Command Center</Link></div>
  </header>
  <div className="storage-banner">Local-development consulting prototype. Methodology templates are starting points requiring professional review; they are not accreditation standards or client-approved scopes.</div>
  {error&&<p className="storage-error" role="alert">{error}</p>}
  {message&&<p className="storage-banner" role="status">{message}</p>}
  <nav className="method-tabs" aria-label="Methodology workflows">
   <button type="button" className={tab==="create"?"active":""} onClick={()=>setTab("create")}>Apply a methodology</button>
   <button type="button" className={tab==="custom"?"active":""} onClick={()=>setTab("custom")}>Create custom methodology</button>
  </nav>
  {tab==="create"&&<div className="method-columns"><section className="method-panel">
   <h2>Service methodology catalog</h2><p>Choose an expert-designed baseline or a saved custom methodology.</p>
   <div className="method-catalog">{methods.map(item=><button key={item.id} type="button" className={"method-card "+(selected===item.id?"chosen":"")} onClick={()=>{setSelected(item.id);setResult(null)}}>
    <strong>{item.title}</strong><small>{item.builtin?"Standard baseline":"Custom methodology"} · rev {item.revision}</small>
    <span>{item.description}</span><b>{item.blueprint.audits.length} audit modules · {item.blueprint.milestones.length} milestones · {item.blueprint.deliverables.length} outputs</b>
   </button>)}</div>
  </section>
  <section className="method-panel">{method?<><div className="method-panel-head"><div><h2>{method.title}</h2><p>Service blueprint · revision {method.revision}</p></div><button className="secondary" type="button" onClick={duplicate}>Customize copy</button></div>
   <h3>Delivery objective</h3><p>{method.blueprint.objective}</p><h3>Included scope</h3><p>{method.blueprint.scope}</p>
   <h3>Frozen audit modules</h3><div className="method-module-list">{method.blueprint.audits.map(a=><details key={a.key}><summary><b>{a.title}</b> · {a.criteria.length} criteria · day {a.offsetDays??"unscheduled"}</summary>
    <ol>{a.criteria.map(c=><li key={c.code}><strong>{c.code}</strong> {c.text}</li>)}</ol></details>)}</div>
   <h3>Delivery milestones</h3><div className="method-work-list">{method.blueprint.milestones.map((m,i)=><p key={i}><b>{m.title}</b> · day {m.offsetDays??"undated"} · {m.owner||"Owner assigned on creation"}</p>)}</div>
   <h3>Contractual / internal deliverables</h3><div className="method-work-list">{method.blueprint.deliverables.map((d,i)=><p key={i}><b>{d.title}</b> · day {d.offsetDays??"undated"}{d.auditKey?" · linked audit":""}</p>)}</div>
  </>:<p>Choose a methodology to preview its contents.</p>}</section>
  <section className="method-panel method-apply"><h2>Start a client project</h2><p>The project, lifecycle, audit checklist snapshots and linked outputs are created together.</p>
   <label>Client<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Choose an existing client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label>Project name<input maxLength={160} value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Example: Q1 supplier measurement assessment"/></label>
   <label>Project reference<input maxLength={100} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional contract / internal reference"/></label>
   <label>Start date<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
   <label>Default engagement owner<input maxLength={120} value={owner} onChange={e=>setOwner(e.target.value)} placeholder="Optional"/></label>
   <button type="button" className="primary" disabled={busy||!clientId||!projectName.trim()||!method} onClick={()=>void apply()}>{busy?"Creating…":"Generate complete engagement"}</button>
   {result&&<div className="method-success"><h3>Engagement generated</h3><p>{result.auditIds.length} frozen audit checklists · {result.milestoneCount} milestones · {result.deliverableCount} deliverables</p>
    <Link href={result.planUrl}>Open project lifecycle</Link><Link href={result.packUrl}>Preview project pack</Link>
    <Link href="/delivery">Review delivery schedule</Link></div>}
   <p className="method-small">Existing client records only. Create clients in Clients & Projects first. Generation is atomic: failures do not leave half-created engagements.</p>
  </section></div>}
  {tab==="custom"&&<div className="method-custom method-panel"><h2>Publish a custom reusable methodology</h2>
   <p>Start from “Customize copy” on a standard baseline, then edit the blueprint JSON. Revisions are immutable on applied projects; saving a new title creates a separate catalog entry. No existing audit or project is changed.</p>
   <div className="method-custom-fields"><label>Catalog title<input value={customTitle} onChange={e=>setCustomTitle(e.target.value)} maxLength={160}/></label>
    <label>Revision<input value={revision} onChange={e=>setRevision(e.target.value)} maxLength={40}/></label>
    <label>Description<input value={customDescription} onChange={e=>setCustomDescription(e.target.value)} maxLength={1000}/></label></div>
   <label>Validated blueprint JSON<textarea rows={22} spellCheck={false} value={blueprintJson} onChange={e=>setBlueprintJson(e.target.value)} placeholder="Copy a built-in methodology to begin"/></label>
   <button type="button" className="primary" onClick={()=>void saveCustom()} disabled={busy||!customTitle.trim()||!blueprintJson.trim()}>Publish custom methodology</button>
   <p className="method-small">BluePrint limits: up to 15 audit modules, 100 requirements per module, 30 milestones and 40 deliverables. Every linked deliverable must reference a declared audit key. No client data or executable scripts allowed.</p>
  </div>}
 </main>;
}
