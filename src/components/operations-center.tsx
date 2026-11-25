"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Activity,AlertCircle,BriefcaseBusiness,CalendarClock,CheckCircle2,ClipboardCheck,Download,FileCheck2,RefreshCw,ShieldAlert} from "lucide-react";
type Audit={id:string;title:string;client:string;project:string;status:string;sealed:boolean;sha256:string|null;updatedAt:string};
type Finding={id:string;auditId:string;auditTitle:string;client:string;code:string;title:string;severity:string;status:string;openActions:number};
type Action={id:string;findingId:string;auditId:string;auditTitle:string;client:string;description:string;owner:string;status:string;dueDate:string|null;overdue:boolean};
type Evidence={id:string;auditId:string;auditTitle:string;client:string;requirementCode:string;reference:string;description:string};
type Portfolio={asOf:string;summary:{audits:number;activeAudits:number;completedAudits:number;openFindings:number;openActions:number;overdueActions:number;evidenceReferences:number;sealedReports:number};audits:Audit[];findings:Finding[];actions:Action[];evidence:Evidence[];limit:number};
type Mode="overview"|"findings"|"reports"|"evidence";
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/^./,x=>x.toUpperCase());
export default function OperationsCenter({mode,onOpenAudit}:{mode:Mode;onOpenAudit:(id:string)=>void}){
 const [data,setData]=useState<Portfolio|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [filter,setFilter]=useState("");
 const [onlyOpen,setOnlyOpen]=useState(true);
 const reload=useCallback(async()=>{
  setLoading(true);setError("");
  try{const response=await fetch("/api/operations",{cache:"no-store"});const body=await response.json();
   if(!response.ok)throw Error(body.error||"Portfolio is unavailable");setData(body);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load portfolio")}finally{setLoading(false)}
 },[]);
 useEffect(()=>{void reload()},[reload]);
 const query=filter.trim().toLowerCase();
 const matches=(...parts:(string|undefined|null)[])=>!query||parts.some(x=>(x||"").toLowerCase().includes(query));
 const actions=useMemo(()=>data?.actions.filter(x=>(!onlyOpen||x.status!=="VERIFIED")&&matches(x.owner,x.client,x.auditTitle,x.description))||[],[data,onlyOpen,query]);
 const findings=useMemo(()=>data?.findings.filter(x=>(!onlyOpen||x.status!=="CLOSED")&&matches(x.client,x.title,x.auditTitle,x.code))||[],[data,onlyOpen,query]);
 const audits=useMemo(()=>data?.audits.filter(x=>matches(x.client,x.title,x.project,x.status))||[],[data,query]);
 const evidence=useMemo(()=>data?.evidence.filter(x=>matches(x.client,x.auditTitle,x.requirementCode,x.reference))||[],[data,query]);
 const exportLink=(type:"audits"|"actions"|"findings"|"evidence")=><a className="ops-export" href={"/api/operations/export?type="+type}><Download size={15}/> Export {type} CSV</a>;
 const section=(title:string,subtitle:string)=> <div className="ops-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="secondary" onClick={()=>void reload()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>;
 const counters=data?.summary;
 return <section className="operations-center" aria-label="Live consulting portfolio">
  {mode==="overview"?section("Consulting operations center","Live development database · audit delivery and corrective-action status"):section(mode==="findings"?"Findings & CAPA portfolio":mode==="evidence"?"Evidence reference library":"Audit reporting & delivery","Cross-audit records from PostgreSQL · local development only")}
  {error&&<p className="storage-error" role="alert">{error} · <a href="/login">Sign in to local storage</a></p>}
  {loading&&<p role="status" className="ops-loading">Loading portfolio…</p>}
  {data&&<>
   {mode==="overview"&&<div className="management-entry"><div><strong>Management review · portfolio delivery and risk</strong><p>Live sampled KPIs, client risk triage, overdue-action aging, printable review and downloadable risk exports.</p></div><a href="/management">Open management review</a></div>}
   <div className="ops-metrics">
    {[
     {title:"Audits",value:counters!.audits,icon:ClipboardCheck},
     {title:"Active engagements",value:counters!.activeAudits,icon:BriefcaseBusiness},
     {title:"Open findings",value:counters!.openFindings,icon:AlertCircle},
     {title:"Outstanding actions",value:counters!.openActions,icon:CalendarClock},
     {title:"Overdue actions",value:counters!.overdueActions,icon:ShieldAlert},
     {title:"Sealed reports",value:counters!.sealedReports,icon:CheckCircle2}
    ].map(m=><div className="ops-metric" key={m.title}><div><span>{m.title}</span><m.icon size={17}/></div><strong>{m.value}</strong></div>)}
   </div>
   {mode!=="overview"&&<div className="ops-toolbar"><label>Search portfolio<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Client, audit, owner, reference…"/></label>{mode==="findings"&&<label className="ops-checkbox"><input type="checkbox" checked={onlyOpen} onChange={e=>setOnlyOpen(e.target.checked)}/> Only outstanding items</label>}<span>As of {new Date(data.asOf).toLocaleString("en-GB")}</span></div>}
   {(mode==="overview"||mode==="findings")&&<div className="ops-grid">
    <div className="panel ops-panel">{section("Corrective action tracker",actions.length+" matching actions · "+counters!.overdueActions+" overdue")}{exportLink("actions")}
     {actions.length===0?<p className="registry-empty">No matching corrective actions recorded.</p>:<div className="ops-records">{actions.slice(0,mode==="overview"?8:120).map(a=><article key={a.id} className={a.overdue?"ops-overdue":""}><div><strong>{a.description}</strong><small>{a.client} · {a.owner} · {label(a.status)}</small><small>{a.dueDate?"Due "+new Date(a.dueDate).toLocaleDateString("en-GB"):"No due date"}{a.overdue?" · OVERDUE":""}</small></div><button type="button" className="linkbtn" onClick={()=>onOpenAudit(a.auditId)}>View audit</button></article>)}</div>}
    </div>
    <div className="panel ops-panel">{section("Audit findings",findings.length+" matching records")}{exportLink("findings")}
     {findings.length===0?<p className="registry-empty">No matching findings recorded.</p>:<div className="ops-records">{findings.slice(0,mode==="overview"?8:120).map(f=><article key={f.id}><div><strong>{f.code} · {f.title}</strong><small>{f.client} · {f.severity} · {label(f.status)}</small><small>{f.openActions} actions awaiting verification</small></div><button type="button" className="linkbtn" onClick={()=>onOpenAudit(f.auditId)}>View audit</button></article>)}</div>}
    </div>
   </div>}
   {(mode==="overview"||mode==="reports")&&<div className="panel ops-panel">{section("Audit delivery register",audits.length+" audits · "+counters!.sealedReports+" sealed draft reports")}{exportLink("audits")}
    {audits.length===0?<p className="registry-empty">No audits created yet.</p>:<div className="ops-table-wrap"><table><thead><tr><th>Audit</th><th>Client</th><th>Status</th><th>Report</th></tr></thead><tbody>{audits.slice(0,mode==="overview"?12:120).map(a=><tr key={a.id}><td><button className="audit-open" type="button" onClick={()=>onOpenAudit(a.id)}>{a.title}</button><small>{a.project||a.id}</small></td><td>{a.client}</td><td>{label(a.status)}</td><td><a target="_blank" rel="noopener noreferrer" href={"/reports/"+encodeURIComponent(a.id)}>{a.sealed?"Sealed report":"Draft report"}</a></td></tr>)}</tbody></table></div>}
    <p className="registry-info">Sealed means the app stored a report copy and digest; it is not an approved, externally certified document.</p>
   </div>}
   {mode==="evidence"&&<div className="panel ops-panel">{section("Requirement evidence index",evidence.length+" recorded references")}{exportLink("evidence")}
    {evidence.length===0?<p className="registry-empty">No evidence references recorded.</p>:<div className="ops-table-wrap"><table><thead><tr><th>Reference</th><th>Requirement</th><th>Audit / client</th><th></th></tr></thead><tbody>{evidence.slice(0,200).map(e=><tr key={e.id}><td><strong>{e.reference}</strong><small>{e.description}</small></td><td>{e.requirementCode}</td><td>{e.auditTitle}<small>{e.client}</small></td><td><button className="linkbtn" onClick={()=>onOpenAudit(e.auditId)}>View audit</button></td></tr>)}</tbody></table></div>}
    <p className="registry-info">References are metadata only. No files or calibration evidence have been independently validated.</p>
   </div>}
   <p className="ops-foot"><Activity size={14}/> Results are limited to the newest {data.limit} records per category. Development environment only. Never treat dashboard metrics as independently verified compliance evidence.</p>
  </>}
 </section>
}
