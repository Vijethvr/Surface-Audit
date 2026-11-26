"use client";
import {useEffect,useState} from "react";
import Link from "next/link";

type Match={code:string;excerpt:string;observation:string;reference:string;confidence:"high"|"medium"|"low";assessment:string;question:string;existingAnswer:string;existingComment:string;existingReference:string;hasExisting:boolean};
type Draft=Match&{checked:boolean;answer:"Not assessed"|"Conforms"|"Not applicable";comment:string};
type Analysis={auditRevision:number;procedureSha256:string;mode:"local"|"model";modelEnabled:boolean;warning:string|null;requirements:number;matches:Match[];questions:string[]};
const explanations={high:"Strong wording overlap — still unverified",medium:"Plausible wording overlap — verify",low:"Weak lead — may be unrelated"};
export default function ProcedureIntelligence({params}:{params:Promise<{id:string}>}){
 const [auditId,setAuditId]=useState("");
 const [procedure,setProcedure]=useState("");
 const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const [drafts,setDrafts]=useState<Draft[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [editable,setEditable]=useState(false);const [allowExternal,setAllowExternal]=useState(false);const [answers,setAnswers]=useState<Record<number,string>>({});
 useEffect(()=>{void params.then(p=>setAuditId(p.id))},[params]);
 useEffect(()=>{void fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(v=>setEditable(v.role==="ADMIN"||v.role==="EDITOR")).catch(()=>setEditable(false))},[]);
 const clear=()=>{setAnalysis(null);setDrafts([]);setAnswers({});setNotice("")};
 const analyze=async()=>{
  setBusy(true);setError("");clear();
  try{const response=await fetch("/api/audits/"+encodeURIComponent(auditId)+"/procedure/analyze",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({procedure,allowExternal})});
   const value=await response.json();if(!response.ok)throw Error(value.error||"Unable to analyze procedure");
   setAnalysis(value);
   setDrafts((value.matches as Match[]).map(p=>({...p,checked:false,answer:"Not assessed" as const,comment:p.observation})));
  }catch(e){setError(e instanceof Error?e.message:"Analysis unavailable")}finally{setBusy(false)}
 };
 const update=(code:string,change:Partial<Draft>)=>setDrafts(list=>list.map(x=>x.code===code?{...x,...change}:x));
 const selected=drafts.filter(x=>x.checked&&!x.hasExisting);
 const apply=async()=>{
  if(!analysis||!selected.length)return;
  setBusy(true);setError("");setNotice("");
  try{const response=await fetch("/api/audits/"+encodeURIComponent(auditId)+"/procedure/apply",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    expectedRevision:analysis.auditRevision,procedure,procedureSha256:analysis.procedureSha256,
    entries:selected.map(x=>({code:x.code,excerpt:x.excerpt,answer:x.answer,comment:x.comment,reference:x.reference}))})});
   const value=await response.json();if(!response.ok)throw Error(value.error||"Unable to apply reviewed suggestions");
   setNotice(value.count+" reviewed requirement entries saved at audit revision "+value.revision+". Changes are now in Guided Execution and audit history.");
   clear();setNotice(value.count+" reviewed entries saved. Continue to Guided Execution to complete the assessment and collect evidence.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to save reviewed entries")}finally{setBusy(false)}
 };
 return <main className="procedure-page">
  <header className="procedure-header"><div><Link className="management-return" href={"/audits/"+encodeURIComponent(auditId)+"/execute"}>Guided audit execution</Link>
   <p className="eyebrow">PROCEDURE INTELLIGENCE · EVIDENCE-GROUNDED ASSISTANCE</p>
   <h1>Describe what you actually did.</h1>
   <p>Write your procedure in ordinary language. Review the suggested audit sections, identify what is missing, and decide what to record.</p></div>
   <Link href={"/?audit="+encodeURIComponent(auditId)}>Full audit workspace</Link>
  </header>
  <div className="storage-banner">This assistant extracts suggestions from your narrative, not proof of conformity. Never supply confidential customer information or personal data in this development prototype. AI provider use is opt-in at server configuration.</div>
  {error&&<p role="alert" className="storage-error">{error}</p>}
  {notice&&<p role="status" className="storage-banner">{notice} <Link href={"/audits/"+encodeURIComponent(auditId)+"/execute"}>Open updated assessment</Link></p>}
  <section className="procedure-input">
   <div><h2>1. Procedure narrative</h2><p>Include instrument IDs, certificate references, measurement conditions, acceptance criteria, results and exceptions when you have actually checked them.</p></div>
   <textarea rows={10} maxLength={16000} disabled={busy} value={procedure} onChange={e=>{setProcedure(e.target.value);if(analysis)clear()}}
    placeholder={"Example: We checked the supplier calibration inventory and interval register. The instrument CAL-2027-101 was traced to a current certificate; its serial number matched the register. The temperature was recorded as 20 °C. We did not yet review the operator training records or document the uncertainty budget."}/>
   <label className="procedure-consent"><input type="checkbox" checked={allowExternal} onChange={e=>{setAllowExternal(e.target.checked);clear()}}/> Permit sending this narrative to the configured external AI provider, if enabled. Otherwise analyze locally.</label><div className="procedure-controls"><span>{procedure.length.toLocaleString()} / 16,000 characters</span>
    <button type="button" className="primary" disabled={busy||!editable||procedure.trim().length<40} onClick={()=>void analyze()}>{busy?"Analyzing…":"Analyze procedure and suggest sections"}</button></div>
  </section>
  {analysis&&<><section className="procedure-insight"><div><h2>2. Interpretation results</h2>
    <p>{analysis.mode==="model"?"AI-assisted semantic analysis (opted-in external model)":"Local wording-based analysis — no external AI call"} · {analysis.matches.length} possible matches among {analysis.requirements} requirements.</p>
    {analysis.warning&&<p className="management-warning">{analysis.warning}</p>}
    <p>Every suggested passage is quoted directly from what you wrote. The system does not automatically mark conformance, generate findings, or overwrite existing audit responses.</p></div>
    <div className="procedure-metrics"><strong>{analysis.matches.length}</strong><small>Suggested sections</small><strong>{analysis.questions.length}</strong><small>Open questions</small></div></section>
   <div className="procedure-layout"><section className="procedure-matches"><h2>3. Review proposed audit entries</h2>
    {drafts.length===0&&<p>No matches passed the evidence-grounding check. Use the questions on the right to identify missing details, or work through Guided Execution.</p>}
    {drafts.map(p=><article className="procedure-match" key={p.code}>
     <div className="procedure-match-head"><div><strong>{p.code}</strong><span className={"procedure-confidence "+p.confidence}>{explanations[p.confidence]}</span></div>
      <label><input type="checkbox" disabled={!editable||p.hasExisting} checked={p.checked} onChange={e=>update(p.code,{checked:e.target.checked})}/> Review for saving</label></div>
     <blockquote>{p.excerpt}</blockquote>
     {p.hasExisting?<p className="procedure-existing">Already assessed as {p.existingAnswer}. To protect earlier work, open Guided Execution to make changes deliberately.</p>:<>
      <label>Proposed observation — edit for accuracy<textarea rows={3} maxLength={4000} disabled={!p.checked} value={p.comment} onChange={e=>update(p.code,{comment:e.target.value})}/></label>
      <label>Document or certificate reference<input maxLength={500} disabled={!p.checked} value={p.reference} onChange={e=>update(p.code,{reference:e.target.value})}/></label>
      <label>Operator assessment decision<select disabled={!p.checked} value={p.answer} onChange={e=>update(p.code,{answer:e.target.value as Draft["answer"]})}>
       <option value="Not assessed">Not assessed — document only</option><option value="Conforms">Conforms — I verified it</option>
       <option value="Not applicable">Not applicable — justified by auditor</option></select></label>
      <p className="procedure-question"><strong>Ask yourself:</strong> {p.question}</p></>}
    </article>)}
   </section>
   <aside className="procedure-questions"><h2>4. Missing steps and clarification questions</h2>
    <p>These are prompts for your technical judgement, not statements that a procedure definitely omitted an activity.</p>
    {analysis.questions.length===0?<p>All requirements have a potential text match. Confirm each with actual evidence and the approved checklist.</p>:
     analysis.questions.map((question,i)=><div className="procedure-question-item" key={i}><label><strong>{i+1}. {question}</strong>
      <textarea rows={2} value={answers[i]??""} onChange={e=>setAnswers(x=>({...x,[i]:e.target.value}))} placeholder="Write what you actually checked, or note that this step remains outstanding."/></label></div>)}
    <button type="button" className="secondary" onClick={()=>{const additions=Object.values(answers).map(x=>x.trim()).filter(Boolean).join("\n");if(additions){setProcedure(x=>x+"\n"+additions);clear()}}}>Add your answers to the procedure and re-analyze</button>
   </aside></div>
   <section className="procedure-apply"><div><h2>5. Save only what you've reviewed</h2><p>{selected.length} checked entries. Existing assessments are protected. “Not assessed” entries preserve the observation but do not count as assessed; use Guided Execution for nonconformities and structured findings.</p></div>
    <button type="button" className="primary" disabled={busy||!editable||selected.length===0||selected.some(x=>x.comment.trim().length<5)} onClick={()=>void apply()}>Apply {selected.length} reviewed entries</button></section>
   <footer className="management-footer">Procedure input is not persisted as a raw document. Only approved assessment entries and bounded source quotations in the audit history are stored. External AI mode transmits procedure text to the configured provider only when explicitly enabled. No automatic compliance or accreditation claims.</footer>
  </>}
 </main>;
}
