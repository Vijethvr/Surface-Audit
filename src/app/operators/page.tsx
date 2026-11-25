"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
type Operator={id:string;username:string;role:string;active:boolean;createdAt:string;failedLoginCount:number;loginLockedUntil:string|null};
type SecurityEvent={id:string;eventType:string;outcome:string;actorUsername:string|null;subjectUsername:string|null;createdAt:string};
export default function OperatorsPage(){
 const [operators,setOperators]=useState<Operator[]>([]);
 const [events,setEvents]=useState<SecurityEvent[]>([]);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{const r=await fetch("/api/operators",{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to load operators");setOperators(data.operators)},[]);
 const refreshEvents=useCallback(async()=>{
  const r=await fetch("/api/security/events?limit=50",{cache:"no-store"});
  const data=await r.json();if(!r.ok)throw Error(data.error||"Security register unavailable");
  setEvents(data.events);
 },[]);
 useEffect(()=>{void refresh().catch(e=>setError(String(e)));void refreshEvents().catch(e=>setError(String(e)))},[refresh,refreshEvents]);
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
  <div className="operators-top"><div><h2>Security event register</h2><p>Recent local sign-ins, lockouts, account changes and review decisions · latest 50</p></div>
    <button type="button" className="secondary" onClick={()=>void refreshEvents().catch(e=>setError(String(e)))}>Refresh security log</button>
  </div>
  <div className="ops-table-wrap"><table><thead><tr><th>Recorded</th><th>Event</th><th>Result</th><th>Actor</th><th>Subject</th></tr></thead>
   <tbody>{events.map(event=><tr key={event.id}><td>{new Date(event.createdAt).toLocaleString("en-GB")}</td><td>{event.eventType}</td><td>{event.outcome}</td><td>{event.actorUsername??"—"}</td><td>{event.subjectUsername??"—"}</td></tr>)}</tbody>
  </table>{events.length===0&&<p className="registry-info">No security events have been recorded yet.</p>}</div>
  <p className="registry-info">Events do not contain passwords, session tokens or uploaded evidence. The database owner can still modify or remove these records by changing PostgreSQL permissions or triggers.</p>
  <p className="registry-info">Account creation is deliberately restricted to a local CLI script. There is no self-registration or web-based password provisioning.</p>
  <p className="registry-info">This environment is development-only. Session revocation cannot revoke copies of exported files or reports.</p>
 </div></main>;
}