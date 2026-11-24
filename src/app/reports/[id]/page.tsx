"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
type Ref={reference:string;description:string|null};
type Action={description:string;owner:string;dueDate:string|null;status:string;closureEvidence:string|null;verifiedBy:string|null};
type Finding={id:string;title:string;description:string;severity:string;status:string;actions:Action[]};
type Req={code:string;title:string;assessment:string;observation:string;reference:string;evidenceReferences:Ref[];findings:Finding[]};
type Report={
 reportType:string;reportStatus:string;generatedAt:string;
 audit:{id:string;title:string;status:string;type:string;createdAt:string;client:string;project:string|null};
 template:{title:string;revision:string};reviewer:string;summary:string;
 requirements:Req[];equipment:Array<{identifier:string;name:string;calibrationReference:string|null;calibrationDue:string|null}>;
 counts:{assessed:number;total:number;findings:number;openFindings:number;evidenceReferences:number};
 readiness:{ready:boolean;blockers:string[]};activityCount:number;
};
export default function ReportView(){
 const params=useParams<{id:string}>();
 const [report,setReport]=useState<Report|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/audits/"+encodeURIComponent(params.id)+"/report",{cache:"no-store"});
   const json=await response.json();
   if(!response.ok)throw Error(json.error||"Report unavailable");
   setReport(json.report);
  }catch(err){setError(err instanceof Error?err.message:"Unable to retrieve report")}finally{setLoading(false)}
 },[params.id]);
 useEffect(()=>{void refresh()},[refresh]);
 return <main className="print-report">
 <div className="report-controls">
  <Link href="/">SURFACE Audit · Workspace</Link>
  <div><button type="button" onClick={()=>void refresh()} disabled={loading}>Refresh saved data</button>
  <button type="button" onClick={()=>window.print()} disabled={!report}>Print / Save as PDF</button></div>
 </div>
 {loading&&<p role="status">Loading saved audit report…</p>}
 {error&&<p className="storage-error" role="alert">{error} · <Link href="/login">Sign in</Link></p>}
 {report&&<>
  <header className="report-head"><p className="eyebrow">SURFACE Audit · MEASUREMENT ASSURANCE</p><h1>{report.audit.title}</h1><p className="report-watermark">{report.reportStatus}</p>
   <p>This document summarizes development-stage records. It does not certify conformity, traceability, independent approval or evidentiary authenticity.</p>
  </header>
  <section className="report-metadata">
   <div><small>Audit ID</small><b>{report.audit.id}</b></div>
   <div><small>Client</small><b>{report.audit.client}</b></div>
   <div><small>Project</small><b>{report.audit.project||"Not linked"}</b></div>
   <div><small>Workflow status</small><b>{report.audit.status}</b></div>
   <div><small>Checklist</small><b>{report.template.title} · {report.template.revision}</b></div>
   <div><small>Generated</small><b>{new Date(report.generatedAt).toLocaleString("en-GB")}</b></div>
  </section>
  <section className="report-section"><h2>Completion readiness</h2>
   <p><b>{report.readiness.ready?"All configured checks passed":"Review required before completion"}</b></p>
   {report.readiness.blockers.length>0&&<ul>{report.readiness.blockers.map((item,index)=><li key={index}>{item}</li>)}</ul>}
   <p>Requirements assessed: {report.counts.assessed} / {report.counts.total} · Findings: {report.counts.findings} · Open findings: {report.counts.openFindings} · Evidence references: {report.counts.evidenceReferences}</p>
  </section>
  <section className="report-section"><h2>Review summary</h2>
   <p><b>Reviewer identifier:</b> {report.reviewer||"Not entered"}</p>
   <p className="report-pre">{report.summary||"No review summary saved."}</p>
  </section>
  <section className="report-section"><h2>Requirement assessments</h2>
   {report.requirements.map(req=><article key={req.code} className="report-requirement">
    <h3>{req.code} · {req.title}</h3>
    <p><b>Assessment:</b> {req.assessment}</p><p><b>Observation:</b> {req.observation||"None recorded"}</p>
    {req.reference&&<p><b>Checklist reference:</b> {req.reference}</p>}
    {req.evidenceReferences.map((e,i)=><p key={i}><b>Evidence reference:</b> {e.reference} {e.description?(" — "+e.description):""}</p>)}
    {req.findings.map(f=><div className="report-finding" key={f.id}><p><b>Finding:</b> {f.title} · {f.severity} · {f.status}</p><p>{f.description}</p>
     {f.actions.map((a,i)=><p key={i}>Action: {a.description} · Owner: {a.owner} · Status: {a.status} · Verification ref: {a.closureEvidence||"None"} · Verifier: {a.verifiedBy||"None"}</p>)}
    </div>)}
   </article>)}
  </section>
  <section className="report-section"><h2>Associated instruments</h2>
   {report.equipment.length===0?<p>No instruments assigned.</p>:<table><thead><tr><th>Identifier</th><th>Name</th><th>Calibration ref</th><th>Due date</th></tr></thead><tbody>{report.equipment.map(e=><tr key={e.identifier}><td>{e.identifier}</td><td>{e.name}</td><td>{e.calibrationReference||"Not recorded"}</td><td>{e.calibrationDue?new Date(e.calibrationDue).toLocaleDateString("en-GB"):"Not recorded"}</td></tr>)}</tbody></table>}
   <p className="report-footnote">Instrument assignment and recorded calibration dates are not independent verification of calibration validity.</p>
  </section>
  <footer>UNAPPROVED DEVELOPMENT DRAFT · SURFACE Audit · Not an ISO certificate or controlled approved report</footer>
 </>}
 </main>;
}
