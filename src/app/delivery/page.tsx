"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
type Item={id:string;kind:"AUDIT"|"ACTION";auditId:string;auditTitle:string;client:string;project:string;title:string;
 owner:string;date:string|null;status:string;severity:string;daysFromToday:number|null;bucket:string};
type Data={today:string;asOf:string;scope:{truncated:boolean;notice:string;activeAuditTotal:number;unverifiedActionTotal:number};
 clients:string[];owners:string[];metrics:{overdue:number;dueToday:number;next7:number;next30:number;unscheduled:number;activeAudits:number;outstandingActions:number};
 timeline:Array<{week:number;start:string;due:number}>;items:Item[]};
const displayDate=(date:string|null)=>date?new Date(date+"T00:00:00Z").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}):"Not scheduled";
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/^./,c=>c.toUpperCase());
export default function DeliveryPage(){
 const [client,setClient]=useState("");const [owner,setOwner]=useState("");const [kind,setKind]=useState("");
 const [range,setRange]=useState("ALL");const [search,setSearch]=useState("");
 const [mayEdit,setMayEdit]=useState(false);const [editing,setEditing]=useState("");const [draftDate,setDraftDate]=useState("");const [saving,setSaving]=useState(false);
 const [data,setData]=useState<Data|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const query=useMemo(()=>{const p=new URLSearchParams();if(client)p.set("client",client);if(owner)p.set("owner",owner);if(kind)p.set("kind",kind);
  if(range!=="ALL")p.set("range",range);return p.toString()},[client,owner,kind,range]);
 const load=useCallback(async()=>{setBusy(true);setError("");try{
  const r=await fetch("/api/delivery"+(query?"?"+query:""),{cache:"no-store"});const body=await r.json();
  if(!r.ok)throw Error(body.error||"Delivery board unavailable");setData(body);
 }catch(e){setError(e instanceof Error?e.message:"Unable to load delivery board")}finally{setBusy(false)}},[query]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{void fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(s=>setMayEdit(s.role==="ADMIN"||s.role==="EDITOR")).catch(()=>setMayEdit(false))},[]);
 const saveDate=async(item:Item)=>{setSaving(true);setError("");try{const response=await fetch("/api/delivery/schedule",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:item.kind,id:item.id.split(":")[1],date:draftDate||null})});const result=await response.json();if(!response.ok)throw Error(result.error||"Unable to change date");setEditing("");await load()}catch(e){setError(e instanceof Error?e.message:"Unable to reschedule")}finally{setSaving(false)}};
 const rows=useMemo(()=>data?.items.filter(item=>[item.title,item.client,item.owner,item.auditTitle,item.project].some(v=>v.toLowerCase().includes(search.toLowerCase())))??[],[data,search]);
 const maxWeek=Math.max(1,...(data?.timeline.map(w=>w.due)??[]));
 const calendarQuery=query?query+"&format=ics":"format=ics";
 return <main className="delivery-page">
  <header className="delivery-header"><div><Link href="/" className="management-return">SURFACE Audit · Workspace</Link>
   <p className="eyebrow">CONSULTING DELIVERY · LIVE COMMITMENTS</p><h1>Delivery Command Center</h1>
   <p>Audit targets, corrective-action deadlines and unscheduled work in one planning queue.</p></div>
   <div className="delivery-actions"><Link href="/management">Management review</Link>
    <button type="button" className="secondary" onClick={()=>void load()} disabled={busy}>Refresh</button>
    <a className="primary" href={"/api/delivery?"+calendarQuery}>Export calendar (.ics)</a></div></header>
  <div className="storage-banner">Local PostgreSQL development planning only · calendar events are tentative · no customer data or production access.</div>
  <section className="delivery-toolbar" aria-label="Delivery filters">
   <label>Client <select value={client} onChange={e=>setClient(e.target.value)}><option value="">All clients</option>{data?.clients.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <label>Owner <select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All owners</option>{data?.owners.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <label>Work type <select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Audit + CAPA</option><option value="AUDIT">Audit targets</option><option value="ACTION">Corrective actions</option></select></label>
   <label>Time horizon <select value={range} onChange={e=>setRange(e.target.value)}><option value="ALL">All commitments</option><option value="OVERDUE">Overdue</option><option value="NEXT_7">Next 7 days</option><option value="NEXT_30">Next 30 days</option><option value="NEXT_90">Next 90 days</option><option value="UNSCHEDULED">Not scheduled</option></select></label>
   <label>Search <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Audit, client or action…"/></label>
  </section>
  {busy&&<p role="status" className="storage-banner">Refreshing delivery commitments…</p>}
  {error&&<p role="alert" className="storage-error">{error} <Link href="/login">Sign in</Link></p>}
  {data&&<>
   <div className="management-scope"><strong>Planning day: {displayDate(data.today)}</strong><span>Snapshot {new Date(data.asOf).toLocaleString("en-GB")}</span>
    <p>{data.scope.notice}</p>{data.scope.truncated&&<p className="management-warning">At least one category exceeded 500. Counts shown are for sampled records, not the entire database.</p>}</div>
   <section aria-label="Delivery scorecard" className="delivery-scorecard">
    {([["Overdue",data.metrics.overdue],["Due today",data.metrics.dueToday],
      ["Next 7 days",data.metrics.next7],["Next 30 days",data.metrics.next30],
      ["No target date",data.metrics.unscheduled],["Active audits",data.metrics.activeAudits],
      ["Open CAPA",data.metrics.outstandingActions]] as Array<[string,number]>).map(([name,count])=>
       <div className="management-kpi" key={name}><span>{name}</span><strong>{count}</strong></div>)}
   </section>
   <section className="delivery-panel"><h2>Next 13 weeks · commitment load</h2><p>Scheduled items due during each seven-day period. Older overdue and undated work are listed separately below.</p>
    <div className="delivery-week-grid">{data.timeline.map(week=><div key={week.week} className="delivery-week">
     <span>W{week.week}</span><div className="delivery-week-bar"><div style={{height:Math.max(4,week.due/maxWeek*100)+"%"}}/></div>
     <b>{week.due}</b><small>{displayDate(week.start)}</small></div>)}</div>
   </section>
   <section className="delivery-panel"><div className="delivery-list-heading"><div><h2>Delivery queue</h2><p>{rows.length} matching commitments · deadlines ordered by urgency</p></div>
    <button type="button" className="secondary" onClick={()=>{setClient("");setOwner("");setKind("");setRange("ALL");setSearch("")}}>Clear filters</button></div>
    <div className="ops-table-wrap"><table><thead><tr><th>Commitment / audit</th><th>Client</th><th>Owner</th><th>Due</th><th>State</th><th>Open</th></tr></thead>
     <tbody>{rows.map(item=><tr key={item.id}><td><strong>{item.title}</strong><small>{item.kind==="ACTION"?"Corrective action":"Audit target"} · {item.auditTitle}</small></td>
      <td>{item.client}{item.project&&<small>{item.project}</small>}</td><td>{item.owner||"—"}</td><td>{editing===item.id?<div className="delivery-date-editor"><input type="date" aria-label={"New deadline for "+item.title} value={draftDate} onChange={e=>setDraftDate(e.target.value)}/><button type="button" disabled={saving} onClick={()=>void saveDate(item)}>Save</button><button type="button" onClick={()=>setEditing("")}>Cancel</button></div>:<>{displayDate(item.date)}
      {item.daysFromToday!==null&&item.daysFromToday<0&&<small className="delivery-late">{Math.abs(item.daysFromToday)} days overdue</small>}
      {mayEdit&&<button className="delivery-date-change" type="button" onClick={()=>{setEditing(item.id);setDraftDate(item.date??"")}}>Change date</button>}</>}</td>
      <td>{label(item.status)}{item.severity&&<small>{label(item.severity)} severity</small>}</td>
      <td><Link href={"/?audit="+encodeURIComponent(item.auditId)}>Open audit</Link></td></tr>)}</tbody></table></div>
    {rows.length===0&&<p>No commitments match these filters.</p>}
   </section>
   <footer className="management-footer">Read-only planning projection. Audit dates and action due dates are commitments, not proof of completion or accredited assurance. Calendar exports omit undated items and require review before sharing.</footer>
  </>}
 </main>;
}
