"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
type Pack={
 contentSha256:string;exportReady:boolean;
 content:{generatedAt:string;client:{name:string};project:{name:string;reference:string|null};
 lifecycle:{revision:number;stage:string;objective:string;scope:string;exclusions:string;commercialNote:string;
 milestones:Array<{id:string;title:string;owner:string;dueDate:string|null;status:string;note:string}>;
 deliverables:Array<{id:string;title:string;description:string;auditId:string|null;dueDate:string|null;status:string;acceptedBy:string;acceptanceNote:string}>};
 readiness:{ready:boolean;blockers:string[]};scope:{complete:boolean;counts:{audits:number;actions:number;evidence:number}};
 audits:Array<{id:string;title:string;status:string;targetDate:string|null;reportSha256:string|null;reportIntegrity:string;reportUrl:string;dossierUrl:string|null;findingCount:number;openFindings:number;openActions:number;evidenceFiles:number}>;
 actions:Array<{id:string;title:string;owner:string;status:string;dueDate:string|null;finding:string;severity:string;auditId:string}>;
 evidence:Array<{id:string;filename:string;requirementCode:string;sha256:string;sizeBytes:number;uploadedBy:string;auditId:string}>}};
const human=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/^./,s=>s.toUpperCase());
export default function ProjectPackPage({params}:{params:Promise<{id:string}>}){
 const [id,setId]=useState("");const [data,setData]=useState<Pack|null>(null);
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 useEffect(()=>{void params.then(p=>setId(p.id))},[params]);
 const refresh=useCallback(async()=>{if(!id)return;setBusy(true);setError("");
  try{const r=await fetch("/api/projects/"+encodeURIComponent(id)+"/pack",{cache:"no-store"});
   const v=await r.json();if(!r.ok)throw Error(v.error||"Project pack unavailable");setData(v)
  }catch(e){setError(e instanceof Error?e.message:"Unable to assemble project pack")}finally{setBusy(false)}
 },[id]);
 useEffect(()=>{void refresh()},[refresh]);
 const base="/api/projects/"+encodeURIComponent(id)+"/pack";
 return <main className="pack-page">
  <header className="pack-header"><div><Link href={"/engagements/"+encodeURIComponent(id)+"/plan"} className="management-return">Project lifecycle plan</Link>
   <p className="eyebrow">CONSULTING DELIVERY · HANDOFF ASSEMBLY</p><h1>Project Deliverables Pack</h1>
   <p>One consolidated view of scope, planned outputs, audit assurance, corrective actions and evidence custody.</p></div>
   <div className="pack-actions no-print">
    <button type="button" className="secondary" onClick={()=>void refresh()} disabled={busy}>Refresh assembly</button>
    <button type="button" className="secondary" onClick={()=>window.print()} disabled={!data}>Print / Save PDF</button>
    {data?.exportReady&&<><a className="primary" href={base+"?format=package"}>Export verified JSON pack</a>
     <a className="secondary" href={base+"?format=csv"}>Export CSV register</a></>}
   </div></header>
  <div className="storage-banner">Internal development handoff only. This is not a signed client acceptance, independently authenticated report, or accredited assessment.</div>
  {error&&<p className="storage-error" role="alert">{error} <Link href="/login">Sign in</Link></p>}
  {busy&&<p className="storage-banner" role="status">Assembling current project snapshot…</p>}
  {data&&<><section className="pack-cover">
   <p className="eyebrow">SURFACE AUDIT · PROJECT DELIVERY RECORD</p>
   <h2>{data.content.project.name}</h2><h3>{data.content.client.name}</h3>
   <p>{data.content.project.reference??"No project reference"} · {human(data.content.lifecycle.stage)} · Plan revision {data.content.lifecycle.revision}</p>
   <p>Snapshot generated {new Date(data.content.generatedAt).toLocaleString("en-GB")}</p>
   <div className="pack-integrity">Content SHA-256: <code>{data.contentSha256}</code></div>
  </section>
  <section className="pack-score">
   {([["Audits",data.content.scope.counts.audits],["Corrective actions",data.content.scope.counts.actions],
     ["Evidence files",data.content.scope.counts.evidence],["Milestones",data.content.lifecycle.milestones.length],
     ["Deliverables",data.content.lifecycle.deliverables.length]] as Array<[string,number]>).map(([name,count])=><div key={name}><span>{name}</span><strong>{count}</strong></div>)}
  </section>
  <section className="pack-panel"><h2>Handoff readiness</h2>
   <p><strong>{data.exportReady?"Internal export prerequisites satisfied":"Not ready for final package export"}</strong></p>
   {data.content.readiness.blockers.length>0&&<ul>{data.content.readiness.blockers.map(b=><li key={b}>{b}</li>)}</ul>}
   <p>The JSON/CSV download is disabled until project closure and linked-report integrity prerequisites are met. Printing this preview is not evidence of approval.</p>
  </section>
  <section className="pack-panel"><h2>Engagement executive summary</h2>
   <h3>Objective</h3><p>{data.content.lifecycle.objective||"Not defined"}</p>
   <h3>Scope</h3><p>{data.content.lifecycle.scope||"Not defined"}</p>
   <h3>Exclusions</h3><p>{data.content.lifecycle.exclusions||"Not defined"}</p>
   <h3>Commercial / quotation context</h3><p>{data.content.lifecycle.commercialNote||"Not provided"}</p>
  </section>
  <section className="pack-panel"><h2>Milestone and deliverables register</h2>
   <div className="ops-table-wrap"><table><thead><tr><th>Milestone</th><th>Owner</th><th>Due</th><th>Progress</th></tr></thead>
    <tbody>{data.content.lifecycle.milestones.map(m=><tr key={m.id}><td><strong>{m.title}</strong><small>{m.note}</small></td><td>{m.owner||"—"}</td><td>{m.dueDate??"Undated"}</td><td>{human(m.status)}</td></tr>)}</tbody></table></div>
   <h3>Client and internal deliverables</h3><div className="ops-table-wrap"><table><thead><tr><th>Output</th><th>Status</th><th>Due</th><th>Acceptance record</th></tr></thead>
    <tbody>{data.content.lifecycle.deliverables.map(d=><tr key={d.id}><td><strong>{d.title}</strong><small>{d.description}</small></td>
     <td>{human(d.status)}</td><td>{d.dueDate??"Undated"}</td>
     <td>{d.acceptedBy||"Not accepted"}<small>{d.acceptanceNote}</small></td></tr>)}</tbody></table></div>
  </section>
  <section className="pack-panel"><h2>Audit reports and assurance register</h2>
   <div className="ops-table-wrap"><table><thead><tr><th>Audit</th><th>Status</th><th>Findings</th><th>Evidence</th><th>Sealed report integrity</th></tr></thead>
    <tbody>{data.content.audits.map(a=><tr key={a.id}><td><strong>{a.title}</strong><a href={a.reportUrl}>View report</a>{a.dossierUrl&&<a href={a.dossierUrl}>Export audit dossier</a>}</td>
     <td>{human(a.status)}</td><td>{a.openFindings}/{a.findingCount} open<br/>{a.openActions} open CAPA</td><td>{a.evidenceFiles} files</td>
     <td>{human(a.reportIntegrity)}<small>{a.reportSha256??"No sealed snapshot"}</small></td></tr>)}</tbody></table></div>
  </section>
  <section className="pack-panel"><h2>Corrective-action commitments</h2><div className="ops-table-wrap">
   <table><thead><tr><th>Action</th><th>Owner</th><th>Status</th><th>Due</th><th>Finding</th></tr></thead>
    <tbody>{data.content.actions.map(a=><tr key={a.id}><td>{a.title}</td><td>{a.owner}</td><td>{human(a.status)}</td><td>{a.dueDate??"Undated"}</td><td>{a.finding} · {human(a.severity)}</td></tr>)}</tbody></table></div>
  </section>
  <section className="pack-panel"><h2>Evidence inventory</h2><p>Metadata, file lengths and SHA-256 checksums. Evidence file bytes are not bundled into this project management package.</p>
   <div className="ops-table-wrap"><table><thead><tr><th>File</th><th>Requirement</th><th>Size</th><th>Checksum</th></tr></thead>
    <tbody>{data.content.evidence.map(e=><tr key={e.id}><td>{e.filename}</td><td>{e.requirementCode}</td><td>{e.sizeBytes} B</td><td><code>{e.sha256}</code></td></tr>)}</tbody></table></div>
  </section>
  <footer className="management-footer">Development handoff package · SHA-256 detects file changes but does not authenticate its issuer. Review recipient permissions and use independently verified, signed audit dossiers when appropriate. Not a contractual acceptance certificate.</footer>
  </>}
 </main>;
}
