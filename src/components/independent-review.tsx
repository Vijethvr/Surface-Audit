"use client";
import {useCallback,useEffect,useState} from "react";
type Review={reviewerName:string;decision:"APPROVED"|"REJECTED";note:string;reviewedAt:string};
export default function IndependentReview({auditId,revision}:{auditId:string;revision:number}){
 const [role,setRole]=useState<string|null>(null);
 const [review,setReview]=useState<Review|null>(null);
 const [current,setCurrent]=useState(false);
 const [note,setNote]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  try{
   const [session,response]=await Promise.all([fetch("/api/auth/session",{cache:"no-store"}),fetch("/api/audits/"+encodeURIComponent(auditId)+"/review",{cache:"no-store"})]);
   const [user,data]=await Promise.all([session.json(),response.json()]);
   if(!response.ok)throw Error(data.error||"Review unavailable");
   setRole(user.role??null);setReview(data.review);setCurrent(data.current);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load review")}
 },[auditId]);
 useEffect(()=>{void refresh()},[refresh,revision]);
 async function decide(decision:"APPROVED"|"REJECTED"){
  setBusy(true);setError("");setMessage("");
  try{
   const r=await fetch("/api/audits/"+encodeURIComponent(auditId)+"/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,note})});
   const data=await r.json();if(!r.ok)throw Error(data.error||"Review rejected");
   setNote("");setMessage("Independent review recorded. Refresh the audit before completing.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to record review")}finally{setBusy(false)}
 }
 return <div className="independent-review"><h3>Independent operator review</h3>
  <p>Audit must be In review, pass readiness checks, and be approved by a different operator from the last preparer before completion.</p>
  {review&&<div className="review-summary"><b>{review.decision} · {review.reviewerName}</b><span>{new Date(review.reviewedAt).toLocaleString("en-GB")}</span><p>{review.note}</p><small>{current?"Approval matches the latest recorded audit changes":"Approval absent, rejected or invalidated by subsequent changes"}</small></div>}
  {(role==="REVIEWER"||role==="ADMIN")&&<div className="review-form"><label>Review rationale<textarea rows={3} minLength={8} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Record objective reasoning for approving or returning the audit" /></label><div><button type="button" className="secondary" disabled={busy||note.trim().length<8} onClick={()=>decide("REJECTED")}>Return for correction</button><button type="button" className="primary" disabled={busy||note.trim().length<8} onClick={()=>decide("APPROVED")}>Approve readiness</button></div></div>}
  {error&&<p className="storage-error" role="alert">{error}</p>}
  {message&&<p className="storage-banner" role="status">{message}</p>}
  <p className="registry-info">This is local-development role separation, not a legally binding signature, independent calibration verification, or accredited approval.</p>
 </div>;
}