"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";

type Client={id:string;name:string;audits:number;projects:number};
type Audit={id:string;title:string;status:string;project:string|null;targetDate:string|null;template:string;templateRevision:string|null;sealed:boolean;reportSha256:string|null;latestReview:{decision:string;reviewer:string;at:string}|null;counts:{findings:number;evidenceFiles:number;evidenceReferences:number;equipment:number}};
type Action={id:string;auditId:string;auditTitle:string;finding:string;severity:string;description:string;owner:string;status:string;dueDate:string|null;overdue:boolean;verifiedBy:string|null;hasClosureEvidence:boolean};
type Evidence={id:string;auditId:string;auditTitle:string;filename:string;requirementCode:string;mimeType:string;sizeBytes:number;sha256:string;createdAt:string;uploadedBy:string};
type Deliverable={auditId:string;title:string;status:string;reportSealed:boolean;reportSha256:string|null;reportPath:string;dossierPath:string|null;evidenceFiles:number;latestReview:Audit["latestReview"]};
type Engagement={asOf:string;client:{id:string;name:string};selectedProject:string|null;
 projects:Array<{id:string;name:string;reference:string|null}>;projectsTruncated:boolean;
 scope:{totals:{audits:number;findings:number;actions:number;evidenceFiles:number};sample:{audits:number;findings:number;actions:number;evidenceFiles:number};truncated:boolean;warning:string};
 metrics:{activeAudits:number;completedAudits:number;sealedReports:number;openFindings:number;criticalOpenFindings:number;unverifiedActions:number;overdueActions:number;missingActionDates:number;evidenceFiles:number};
 audits:Audit[];actions:Action[];evidence:Evidence[];deliverables:Deliverable[]};
type Directory={clients:Client[];clientCount:number;directoryTruncated:boolean};
const day=(value:string|null)=>value?new Date(value.slice(0,10)+"T00:00:00Z").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}):"Not scheduled";
const human=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/^./,c=>c.toUpperCase());
export default function EngagementStudio(){
 const [directory,setDirectory]=useState<Directory|null>(null);
 const [client,setClient]=useState("");const [project,setProject]=useState("");
 const [detail,setDetail]=useState<Engagement|null>(null);
 const [search,setSearch]=useState("");const [tab,setTab]=useState<"overview"|"actions"|"evidence"|"handoff">("overview");
 const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 useEffect(()=>{let valid=true;fetch("/api/engagements",{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||"Unable to load clients");
  if(valid){setDirectory(body);const fromUrl=new URLSearchParams(window.location.search).get("client");
  setClient(body.clients.some((c:Client)=>c.name===fromUrl)?fromUrl:(body.clients[0]?.name??""))}
 }).catch(e=>{if(valid)setError(e instanceof Error?e.message:"Unable to load client directory")});return()=>{valid=false}},[]);
 useEffect(()=>{if(!client){setDetail(null);return}let valid=true;setBusy(true);setError("");
  const p=new URLSearchParams({client});if(project)p.set("project",project);
  fetch("/api/engagements?"+p,{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||"Unable to load engagement");
   if(valid)setDetail(body)}).catch(e=>{if(valid){setError(e instanceof Error?e.message:"Engagement unavailable");setDetail(null)}}).finally(()=>{if(valid)setBusy(false)});
  return()=>{valid=false}
 },[client,project]);
 const path=useMemo(()=>{const p=new URLSearchParams({client});if(project)p.set("project",project);return p.toString()},[client,project]);
 const filteredAudits=useMemo(()=>detail?.audits.filter(a=>[a.title,a.project??"",a.status].some(s=>s.toLowerCase().includes(search.toLowerCase())))??[],[detail,search]);
 const filteredActions=useMemo(()=>detail?.actions.filter(a=>[a.description,a.owner,a.auditTitle,a.finding].some(s=>s.toLowerCase().includes(search.toLowerCase())))??[],[detail,search]);
 const filteredEvidence=useMemo(()=>detail?.evidence.filter(e=>[e.filename,e.auditTitle,e.requirementCode,e.uploadedBy].some(s=>s.toLowerCase().includes(search.toLowerCase())))??[],[detail,search]);
 return <main className="eng-studio">
  <header className="eng-header">
   <div><Link href="/" className="management-return">SURFACE Audit · Workspace</Link><p className="eyebrow">CONSULTING DELIVERY · CLIENT ACCOUNT</p>
    <h1>Engagement Studio</h1><p>Client work, corrective actions, evidence custody and report deliverables in one place.</p></div>
   <div className="eng-header-actions no-print"><Link href="/methodologies">New methodology-led project</Link><Link href="/delivery">Delivery planning</Link><Link href="/management">Portfolio review</Link>
    <button type="button" className="secondary" disabled={!detail} onClick={()=>window.print()}>Print client pack / Save PDF</button></div>
  </header>
  <div className="storage-banner no-print">Internal development preview only. Client selection is a reporting filter, not multi-tenant access control. Never use real client data.</div>
  {error&&<p className="storage-error" role="alert">{error} <Link href="/login">Sign in</Link></p>}
  <section className="eng-toolbar no-print" aria-label="Client engagement scope">
   <label>Client organization<select aria-label="Client organization" value={client} onChange={e=>{setClient(e.target.value);setProject("");setTab("overview");setSearch("")}}>
    <option value="">Choose client</option>{directory?.clients.map(c=><option key={c.id} value={c.name}>{c.name} ({c.audits} audits)</option>)}</select></label>
   <label>Engagement / project<select aria-label="Engagement project" value={project} onChange={e=>{setProject(e.target.value);setSearch("")}}>
    <option value="">All projects</option>{detail?.projects.map(p=><option key={p.id} value={p.id}>{p.name}{p.reference?" · "+p.reference:""}</option>)}</select></label>
   {project&&<Link className="lc-project-entry" href={"/engagements/"+encodeURIComponent(project)+"/plan"}>Open project lifecycle planner</Link>}
   {project&&<Link className="lc-project-entry" href={"/engagements/"+encodeURIComponent(project)+"/pack"}>Assemble project deliverables</Link>}
   <label>Find within engagement<input placeholder="Search audits, CAPA, evidence…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <div className="eng-export-actions">
    {detail&&<><a href={"/api/engagements?"+path+"&format=csv"}>Download CSV register</a><a href={"/api/engagements?"+path} download="surface-engagement.json">Download JSON snapshot</a></>}
   </div>
  </section>
  {directory?.directoryTruncated&&<p className="management-warning">Client selector shows the first 250 clients. The full directory contains {directory.clientCount}.</p>}
  {busy&&<p className="storage-banner" role="status">Loading client engagement details…</p>}
  {!client&&<section className="eng-panel"><h2>Choose a client to open their engagement workspace</h2><p>Create clients and projects using the existing registry.</p></section>}
  {detail&&<>
   <div className="eng-scope">
    <div><p className="eyebrow">CLIENT DELIVERY ACCOUNT</p><h2>{detail.client.name}</h2><p>{detail.selectedProject?(detail.projects.find(p=>p.id===detail.selectedProject)?.name??"Selected project"):"All projects and unassigned audits"}</p></div>
    <div className="eng-asof">As of {new Date(detail.asOf).toLocaleString("en-GB")}<small>Sample-limited live snapshot · not an approved client report</small></div>
   </div>
   {detail.scope.truncated&&<p className="management-warning">Detailed lists have reached a cap. Exact scoped totals: {detail.scope.totals.audits} audits, {detail.scope.totals.findings} findings, {detail.scope.totals.actions} actions and {detail.scope.totals.evidenceFiles} evidence files. Metrics below describe displayed samples only.</p>}
   {detail.projectsTruncated&&<p className="management-warning">Project menu is truncated to 150 records.</p>}
   <section className="eng-scorecards" aria-label="Engagement performance">
    {([["Active audits",detail.metrics.activeAudits],["Completed audits",detail.metrics.completedAudits],
      ["Sealed reports",detail.metrics.sealedReports],["Open findings",detail.metrics.openFindings],
      ["High / critical",detail.metrics.criticalOpenFindings],["Outstanding CAPA",detail.metrics.unverifiedActions],
      ["Overdue CAPA",detail.metrics.overdueActions],["Evidence files",detail.metrics.evidenceFiles]] as Array<[string,number]>).map(([title,value])=><div className="eng-stat" key={title}><span>{title}</span><strong>{value}</strong></div>)}
   </section>
   <nav className="eng-tabs no-print" aria-label="Engagement views">{([["overview","Engagements & reports"],["actions","Corrective actions"],["evidence","Evidence inventory"],["handoff","Client handoff"]] as const).map(([id,title])=><button type="button" key={id} onClick={()=>setTab(id)} aria-current={tab===id?"page":undefined} className={tab===id?"active":""}>{title}</button>)}</nav>
   {(tab==="overview"||tab==="handoff")&&<section className="eng-panel"><div className="eng-panel-heading"><h2>Audit and deliverable register</h2><p>{filteredAudits.length} audit engagements in view</p></div>
    <div className="ops-table-wrap"><table><thead><tr><th>Audit / project</th><th>Status & target</th><th>Assurance assets</th><th>Report deliverable</th></tr></thead><tbody>
     {filteredAudits.map(a=><tr key={a.id}><td><strong>{a.title}</strong><small>{a.project??"No project"} · {a.template}{a.templateRevision?" · rev "+a.templateRevision:""}</small>
      <Link href={"/?audit="+encodeURIComponent(a.id)}>Open audit workspace</Link><Link href={"/audits/"+encodeURIComponent(a.id)+"/execute"}>Guided execution</Link></td>
      <td>{human(a.status)}<small>Target: {day(a.targetDate)}</small></td>
      <td>{a.counts.findings} findings · {a.counts.evidenceFiles} files<small>{a.counts.evidenceReferences} evidence references · {a.counts.equipment} linked instruments</small></td>
      <td><strong>{a.sealed?"Sealed local snapshot":"Draft / not sealed"}</strong>
       {a.latestReview&&<small>Latest review: {human(a.latestReview.decision)} · {day(a.latestReview.at)}</small>}
       <Link href={"/reports/"+encodeURIComponent(a.id)}>View report</Link>
       {a.sealed&&<a href={"/api/audits/"+encodeURIComponent(a.id)+"/dossier"}>Export dossier</a>}
      </td></tr>)}</tbody></table></div>{filteredAudits.length===0&&<p>No audits in this scope.</p>}
   </section>}
   {(tab==="actions"||tab==="handoff")&&<section className="eng-panel"><div className="eng-panel-heading"><h2>Corrective-action commitments</h2><p>{filteredActions.length} actions · {detail.metrics.overdueActions} overdue in the sampled scope</p></div>
    <div className="ops-table-wrap"><table><thead><tr><th>Action / finding</th><th>Owner</th><th>Due date</th><th>Status</th><th>Audit</th></tr></thead><tbody>
     {filteredActions.map(a=><tr key={a.id}><td><strong>{a.description}</strong><small>{a.finding} · {human(a.severity)} severity</small></td>
      <td>{a.owner||"Unassigned"}</td><td>{day(a.dueDate)}{a.overdue&&<small className="eng-overdue">Overdue</small>}</td>
      <td>{human(a.status)}{a.verifiedBy&&<small>Verified by {a.verifiedBy}</small>}</td><td><Link href={"/?audit="+encodeURIComponent(a.auditId)}>{a.auditTitle}</Link></td></tr>)}</tbody></table></div>
    {filteredActions.length===0&&<p>No corrective actions in this scope.</p>}
    <p className="eng-footnote">Manage deadlines and owner follow-up in <Link href="/delivery">Delivery Command Center</Link>. This view does not imply that closure evidence has been independently verified.</p>
   </section>}
   {(tab==="evidence"||tab==="handoff")&&<section className="eng-panel"><div className="eng-panel-heading"><h2>Evidence document inventory</h2><p>{filteredEvidence.length} file records · metadata and checksums only</p></div>
    <div className="ops-table-wrap"><table><thead><tr><th>File / requirement</th><th>Linked audit</th><th>Custody record</th><th>Access</th></tr></thead><tbody>
     {filteredEvidence.map(e=><tr key={e.id}><td><strong>{e.filename}</strong><small>{e.requirementCode} · {e.mimeType} · {(e.sizeBytes/1024).toFixed(1)} KiB</small></td>
      <td>{e.auditTitle}</td><td>Uploaded by {e.uploadedBy}<small>{day(e.createdAt)} · SHA-256: {e.sha256.slice(0,20)}…</small></td>
      <td><a href={"/api/audits/"+encodeURIComponent(e.auditId)+"/assets/"+encodeURIComponent(e.id)}>Download file</a></td></tr>)}</tbody></table></div>
    {filteredEvidence.length===0&&<p>No uploaded evidence files in this scope.</p>}
    <p className="eng-footnote">These are database-held file metadata and checksums, not proof of independent legal custody, signer identity or accredited traceability.</p>
   </section>}
   {tab==="handoff"&&<section className="eng-panel"><h2>Handoff review checklist</h2><p>Before sending any document outside the local development environment, confirm the following manually:</p>
    <ul><li>Selected client and project are correct; there is no client portal or tenancy barrier.</li><li>Outstanding findings and corrective actions have been reviewed.</li>
     <li>Only sealed audit reports are represented as sealed; draft reports are clearly identified.</li>
     <li>Evidence file access, personal information and calendar entries have been reviewed for disclosure.</li>
     <li>Printable and exported management packs are informational and are not independently signed.</li></ul>
    <p className="eng-footnote">Use Print / Save PDF above for a browser-generated handoff summary. The CSV register and JSON snapshot contain no uploaded file bytes.</p>
   </section>}
   <footer className="management-footer">SURFACE Audit · Internal consulting engagement summary · Development data only · Records can be sampled. No client distribution, regulatory approval, compliance guarantee or independent signing of this management pack.</footer>
  </>}
 </main>;
}
