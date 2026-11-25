"use client";
import { FormEvent,useState } from "react";
import Link from "next/link";
export default function Login(){
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");
    try{
      const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||"Sign in failed");
      window.location.assign("/");
    }catch(e){setError(e instanceof Error?e.message:"Unable to sign in")}finally{setBusy(false);setPassword("")}
  }
  return <main className="login-screen"><div className="login-card"><div className="login-brand">≋ <span>SURFACE Audit</span></div><p className="eyebrow">LOCAL DEVELOPMENT ACCESS</p><h1>Sign in to your audit workspace</h1><p className="subtitle">Individual local development accounts with viewer, editor, reviewer and administrator roles. Not an enterprise identity solution.</p>
  <form onSubmit={submit}><label>Username<input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="storage-error">{error}</p>}<button className="primary" type="submit" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></form><p className="login-foot"><Link href="/">Return to dashboard</Link> · Development-only authentication</p></div></main>
}
