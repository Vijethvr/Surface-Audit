"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
type Operator={id:string;username:string;role:string;active:boolean;createdAt:string};
export default function OperatorsPage(){
 const [operators,setOperators]=useState<Operator[]>([]);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{const r=await fetch("/api/operators",{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to load operators");setOperators(data.operators)},[]);
 useEffect(()=>{void refresh().catch(e=>setError(String(e)))},[refresh]);
 async function change(operator:Operator){
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/operators",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:operator.id,active:!operator.active})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Operation failed");
   setNotice(operator.active?"Account deactivated and sessions revoked":"Account activated");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to update account")}finally{setBusy(false)}
 }
 return <main className="operators-screen"><div className="panel operators-panel"><div className="operators-top"><div><Link href="/">SURFACE Audit · Workspace</Link><h1>Local operator accounts</h1><p>Administrator-only account status and session revocation</p></div><button type="button" className="secondary" onClick={()=>void refresh().catch(e=>setError(String(e)))}>Refresh</button></div>
  {error&&<p role="alert" className="storage-error">{error}</p>}
  {notice&&<p role="status" className="storage-banner">{notice}</p>}
  <div className="ops-table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{operators.map(op=><tr key={op.id}><td>{op.username}</td><td>{op.role}</td><td>{op.active?"Active":"Disabled"}</td><td><button type="button" className="secondary" disabled={busy} onClick={()=>change(op)}>{op.active?"Deactivate & revoke":"Activate"}</button></td></tr>)}</tbody></table></div>
  <p className="registry-info">Account creation is deliberately restricted to a local CLI script. There is no self-registration or web-based password provisioning.</p>
  <p className="registry-info">This environment is development-only. Session revocation cannot revoke copies of exported files or reports.</p>
 </div></main>;
}