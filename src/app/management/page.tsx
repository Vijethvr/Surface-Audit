"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";

type Review={
 asOf:string;selectedClient:string|null;clients:string[];
 scope:{limitPerCategory:number;notWholeDatabase:boolean;truncated:Record<string,boolean>;warning:string};
 metrics:{audits:number;activeAudits:number;scheduledAudits:number;completedAudits:number;sealedReports:number;openActions:number;overdueActions:number;highCriticalFindings:number;openFindings:number;missingDueDates:number;missingOwners:number;overdueOverThirtyDays:number};
 overdueAging:{oneToSeven:number;eightToThirty:number;overThirty:number};
 topRiskClients:Array<{client:string;score:number;audits:number;openActions:number;overdueActions:number;highCriticalFindings:number;missingDueDates:number;missingOwners:number}>;
 priorityActions:Array<{auditId:string;auditTitle:string;client:string;owner:string;description:string;dueDate:string|null;daysOverdue:number|null;findingSeverity:string}>;
 auditStartsByMonth:Array<{month:string;started:number}>;
 countsByStatus:Array<{status:string;count:number}>;generatedBy:string
};
const pretty=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/^./,x=>x.toUpperCase());
const date=(s:string)=>new Date(s).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
export default function ManagementPage(){
 const [report,setReport]=useState<Review|null>(null);
 const [selectedClient,setSelectedClient]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(true);
 const load=useCallback(async()=>{
  setBusy(true);setError("");
  try{
   const query=selectedClient?"?client="+encodeURIComponent(selectedClient):"";
   const res=await fetch("/api/operations/management"+query,{cache:"no-store"});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||"Management review unavailable");
   setReport(data);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load review")}
  finally{setBusy(false)}
 },[selectedClient]);
 useEffect(()=>{void load()},[load]);
 const exportQuery=selectedClient?"&client="+encodeURIComponent(selectedClient):"";
 const maxStarts=useMemo(()=>Math.max(1,...(report?.auditStartsByMonth.map(x=>x.started)??[])),[report]);
 return <main className="management-page">
  <header className="management-header">
   <div><Link href="/" className="management-return">SURFACE Audit · Workspace</Link><p className="eyebrow">CONSULTING OPERATIONS · MANAGEMENT REVIEW</p><h1>Audit portfolio management review</h1>
    <p>Decision-ready delivery, corrective-action and risk triage for the local development portfolio.</p>
   </div>
   <div className="management-actions no-print"><Link href="/delivery">Delivery planner</Link><button type="button" className="secondary" onClick={()=>void load()} disabled={busy}>Refresh</button><button type="button" className="primary" onClick={()=>window.print()} disabled={!report}>Print / Save PDF</button></div>
  </header>
  <div className="management-toolbar no-print">
   <label>Client scope <select value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}><option value="">All sampled clients</option>{report?.clients.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
   <div className="management-actions"><a href={"/api/operations/management/export?format=json"+exportQuery}>Export report JSON</a><a href={"/api/operations/management/export?format=csv"+exportQuery}>Export risk CSV</a></div>
  </div>
  {error&&<p className="storage-error" role="alert">{error} <Link href="/login">Sign in</Link></p>}
  {busy&&<p role="status" className="storage-banner">Loading live management snapshot…</p>}
  {report&&<>
   <div className="management-scope"><strong>Scope: {report.selectedClient??"All sampled clients"}</strong><span>Generated {new Date(report.asOf).toLocaleString("en-GB")}</span><p>{report.scope.warning}</p>
    {report.scope.notWholeDatabase&&<p className="management-warning">One or more categories reached the 500-record cap. These are incomplete sample metrics, not portfolio-wide totals.</p>}
   </div>
   <section aria-labelledby="management-pulse"><h2 id="management-pulse">Delivery and exposure scorecard</h2>
    <div className="management-kpis">
     {[
      ["Audits in sample",report.metrics.audits],["Active audits",report.metrics.activeAudits],
      ["Completed audits",report.metrics.completedAudits],["Sealed reports",report.metrics.sealedReports],
      ["Open findings",report.metrics.openFindings],["High / critical open",report.metrics.highCriticalFindings],
      ["Open corrective actions",report.metrics.openActions],["Overdue actions",report.metrics.overdueActions],
      ["Overdue 30+ days",report.metrics.overdueOverThirtyDays],["Actions missing dates",report.metrics.missingDueDates]
     ].map(([title,value])=><div className="management-kpi" key={title}><span>{title}</span><strong>{value}</strong></div>)}
    </div>
   </section>
   <div className="management-columns">
    <section className="management-panel"><h2>Corrective-action overdue aging</h2>
     <p>Days late as of UTC midnight on the report date, verified actions excluded.</p>
     {[
      ["1–7 days",report.overdueAging.oneToSeven],
      ["8–30 days",report.overdueAging.eightToThirty],
      ["31+ days",report.overdueAging.overThirty]
     ].map(([name,count])=><div className="management-bar-row" key={name}><span>{name}</span><div className="management-bar"><span style={{width:((Number(count)/Math.max(1,report.metrics.overdueActions))*100)+"%"}}/></div><strong>{count}</strong></div>)}
    </section>
    <section className="management-panel"><h2>Audit starts · last six calendar months</h2><p>Grouped by audit creation month, not completion month.</p>
     {report.auditStartsByMonth.map(a=><div className="management-bar-row" key={a.month}><span>{a.month}</span><div className="management-bar"><span style={{width:(a.started/maxStarts*100)+"%"}}/></div><strong>{a.started}</strong></div>)}
    </section>
   </div>
   <section className="management-panel"><h2>Client delivery risk triage</h2>
    <p>Heuristic score: 3 × overdue actions + 2 × high/critical open findings + undated actions + unowned actions. This is not a compliance rating.</p>
    <div className="ops-table-wrap"><table><thead><tr><th>Client</th><th>Score</th><th>Audits</th><th>Open actions</th><th>Overdue</th><th>High/critical findings</th><th>Missing due dates</th></tr></thead>
    <tbody>{report.topRiskClients.map(row=><tr key={row.client}><td>{row.client}</td><td><strong>{row.score}</strong></td><td>{row.audits}</td><td>{row.openActions}</td><td>{row.overdueActions}</td><td>{row.highCriticalFindings}</td><td>{row.missingDueDates}</td></tr>)}</tbody></table></div>
    {report.topRiskClients.length===0&&<p>No client records in the selected sample.</p>}
   </section>
   <section className="management-panel"><h2>Priority corrective-action follow-up</h2><p>Ordered by days overdue; includes up to 25 outstanding actions from the sampled records.</p>
    <div className="ops-table-wrap"><table><thead><tr><th>Client / audit</th><th>Action</th><th>Owner</th><th>Due date</th><th>Days overdue</th><th>Finding severity</th></tr></thead>
    <tbody>{report.priorityActions.map((a,i)=><tr key={a.auditId+":"+i}><td>{a.client}<small>{a.auditTitle}</small></td><td>{a.description}</td><td>{a.owner||"Unassigned"}</td><td>{a.dueDate?date(a.dueDate):"Not set"}</td><td>{a.daysOverdue??"—"}</td><td>{pretty(a.findingSeverity)}</td></tr>)}</tbody></table></div>
    {report.priorityActions.length===0&&<p>No outstanding corrective actions in this sample.</p>}
   </section>
   <footer className="management-footer">SURFACE Audit · Local development management snapshot · Informational operational triage only. Counts can be truncated; this document is not signed or an accredited audit report.</footer>
  </>}
 </main>;
}
