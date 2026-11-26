"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
type Operator={id:string;username:string;role:string;active:boolean;createdAt:string;failedLoginCount:number;loginLockedUntil:string|null};
type IncidentReview={total:number;returned:number;truncated:boolean;authenticationFailuresAndLockouts:number;windowHours:number;summary:{type:string;outcome:string;count:number}[]};
type SecurityEvent={id:string;eventType:string;outcome:string;actorUsername:string|null;subjectUsername:string|null;createdAt:string};
export default function OperatorsPage(){
 const [operators,setOperators]=useState<Operator[]>([]);
 const [events,setEvents]=useState<SecurityEvent[]>([]);
 const [incident,setIncident]=useState<IncidentReview|null>(null);
 const [incidentHours,setIncidentHours]=useState(168);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{const r=await fetch("/api/operators",{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to load operators");setOperators(data.operators)},[]);
 const refreshIncidents=useCallback(async()=>{
  const r=await fetch(`/api/security/incidents?hours=${incidentHours}&limit=100`,{cache:"no-store"});
  const data=await r.json();if(!r.ok)throw Error(data.error||"Incident review unavailable");
  setIncident(data);setEvents(data.events);
 },[incidentHours]);
 useEffect(()=>{void refresh().catch(e=>setError(String(e)))},[refresh]);
 useEffect(()=>{void refreshIncidents().catch(e=>setError(String(e)))},[refreshIncidents]);
 async function change(operator:Operator){
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/operators",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:operator.id,active:!operator.active})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Operation failed");
   setNotice(operator.active?"Account deactivated and sessions revoked":"Account activated");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update account")}finally{setBusy(false)}
 }
 async function unlock(operator:Operator){
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/operators",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:operator.id,resetLockout:true})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to unlock account");
   setNotice("Sign-in failures cleared for "+operator.username);await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to unlock account")}finally{setBusy(false)}
 }
 return <main className="operators-screen"><div className="panel operators-panel"><div className="operators-top"><div><Link href="/">SURFACE Audit · Workspace</Link><h1>Local operator accounts</h1><p>Administrator-only account status and session revocation</p></div><button type="button" className="secondary" onClick={()=>void refresh().catch(e=>setError(String(e)))}>Refresh</button></div>
  {error&&<p role="alert" className="storage-error">{error}</p>}
  {notice&&<p role="status" className="storage-banner">{notice}</p>}
  <div className="ops-table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Failed logins</th><th>Action</th></tr></thead><tbody>{operators.map(op=><tr key={op.id}><td>{op.username}</td><td>{op.role}</td><td>{op.active?(op.loginLockedUntil&&new Date(op.loginLockedUntil)>new Date()?"Temporarily locked":"Active"):"Disabled"}</td><td>{op.failedLoginCount}</td><td><button type="button" className="secondary" disabled={busy} onClick={()=>change(op)}>{op.active?"Deactivate & revoke":"Activate"}</button> {op.failedLoginCount>0&&<button type="button" className="secondary" disabled={busy} onClick={()=>unlock(op)}>Reset lockout</button>}</td></tr>)}</tbody></table></div>
  <div className="operators-top"><div><h2>Security incident review</h2><p>Administrator-only, time-bounded event summary and safe CSV export. Counts describe events, not distinct people or verified incidents.</p></div>
    <div><label htmlFor="incident-hours">Review period </label><select id="incident-hours" value={incidentHours} onChange={e=>setIncidentHours(Number(e.target.value))}><option value={24}>24 hours</option><option value={168}>7 days</option><option value={720}>30 days</option></select>
    {" "}<button type="button" className="secondary" onClick={()=>void refreshIncidents().catch(e=>setError(String(e)))}>Refresh</button>
    {" "}<a href={`/api/security/incidents?hours=${incidentHours}&limit=500&format=csv`} download>Download CSV (max 500 rows)</a></div>
  </div>
  {incident&&<section aria-label="Security event summary"><p className="registry-info">Events in period: <strong>{incident.total}</strong> · Login failures and lockouts: <strong>{incident.authenticationFailuresAndLockouts}</strong> · Displaying {incident.returned} recent entries. {incident.truncated&&<strong>More records exist beyond this display limit.</strong>}</p>
  <div className="ops-table-wrap"><table><thead><tr><th>Event type</th><th>Outcome</th><th>Count</th></tr></thead><tbody>{incident.summary.map(row=><tr key={row.type+row.outcome}><td>{row.type}</td><td>{row.outcome}</td><td>{row.count}</td></tr>)}</tbody></table></div></section>}
  <div className="ops-table-wrap"><table><thead><tr><th>Recorded</th><th>Event</th><th>Result</th><th>Actor</th><th>Subject</th></tr></thead>
   <tbody>{events.map(event=><tr key={event.id}><td>{new Date(event.createdAt).toLocaleString("en-GB")}</td><td>{event.eventType}</td><td>{event.outcome}</td><td>{event.actorUsername??"—"}</td><td>{event.subjectUsername??"—"}</td></tr>)}</tbody>
  </table>{events.length===0&&<p className="registry-info">No security events have been recorded yet.</p>}</div>
  <p className="registry-info">Events do not contain passwords, session tokens or uploaded evidence. The database owner can still modify or remove these records by changing PostgreSQL permissions or triggers.</p>
  <p className="registry-info">Account creation is deliberately restricted to a local CLI script. There is no self-registration or web-based password provisioning.</p>
  <p className="registry-info">This environment is development-only. Session revocation cannot revoke copies of exported files or reports.</p>
 </div></main>;
}