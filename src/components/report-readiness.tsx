"use client";
import {useCallback,useEffect,useState} from "react";
import {CheckCircle2,AlertTriangle,ExternalLink,RefreshCw} from "lucide-react";
type Readiness={ready:boolean;blockers:string[]};
export default function ReportReadiness({auditId,revision}:{auditId:string;revision:number}){
 const [readiness,setReadiness]=useState<Readiness|null>(null);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  setBusy(true);setError("");
  try{const response=await fetch("/api/audits/"+encodeURIComponent(auditId)+"/report",{cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||"Unable to check completion");
   setReadiness(json.report.readiness);
  }catch(err){setError(err instanceof Error?err.message:"Unavailable")}finally{setBusy(false)}
 },[auditId]);
 useEffect(()=>{void refresh()},[refresh,revision]);
 return <div className="panel audit-readiness">
  <div className="panelhead"><div><h2>Reporting & closure readiness</h2><p>Review saved records only · not a formal audit approval</p></div><button className="secondary" type="button" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={14}/> Refresh</button></div>
  {error&&<p role="alert" className="storage-error">{error}</p>}
  {busy&&<p className="registry-info">Checking stored checklist, evidence and corrective actions…</p>}
  {readiness&&!busy&&<div className="readiness-result">
   <div className="readiness-status">{readiness.ready?<CheckCircle2 color="#087e88" size={20}/>:<AlertTriangle color="#bd6a21" size={20}/>}
    <b>{readiness.ready?"Configured closure checks passed":"Closure blocked: "+readiness.blockers.length+" item(s)"}</b></div>
   {readiness.blockers.length>0&&<ul>{readiness.blockers.map((reason,i)=><li key={i}>{reason}</li>)}</ul>}
  </div>}
  <a className="secondary report-link" href={"/reports/"+encodeURIComponent(auditId)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Open draft report / Print</a>
  <p className="registry-info">Completion requires recorded assessments, a reviewer and summary, and closed verified findings. This does not validate underlying evidence or reviewer identity.</p>
 </div>;
}
