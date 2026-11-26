"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
type Turn={id:string;sequence:number;kind:string;text:string;requirementCode:string|null;author:string;createdAt:string};
type Coverage={code:string;title:string;coverage:"already_recorded"|"possible_gap"|"documentation_gap"|"possible_exception"|"described"|"unmentioned";
 excerpt:string|null;sourceTurnIds:string[];followUp:string;savedAnswer:string};
type Question={code:string;question:string;coverage:Coverage["coverage"]};
type Response={audit:{id:string;title:string;client:string;status:string;revision:number;dialogueRevision:number};
 turns:Turn[];transcript:string;transcriptSha256:string;coverage:Coverage[];nextQuestions:Question[];
 limits:{maxTurns:number;maxCharacters:number};
 metrics:{requirements:number;withPossibleNarrative:number;unmentioned:number;apparentGaps:number;previouslyAssessed:number};warning:string};
type Semantic={mode:"model"|"local";matches:Array<{code:string;excerpt:string;question:string;confidence:string}>;questions:string[];warning:string|null};
const readable=(x:string)=>x.replaceAll("_"," ").toLowerCase().replace(/^./,c=>c.toUpperCase());
export default function AuditCopilot({params}:{params:Promise<{id:string}>}){
 const [id,setId]=useState("");const [data,setData]=useState<Response|null>(null);
 const [text,setText]=useState("");const [target,setTarget]=useState<string|null>(null);
 const [kind,setKind]=useState<"PROCEDURE"|"CLARIFICATION">("PROCEDURE");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [canEdit,setCanEdit]=useState(false);const [external,setExternal]=useState(false);
 const [semantic,setSemantic]=useState<Semantic|null>(null);const [view,setView]=useState<"dialogue"|"coverage">("dialogue");
 useEffect(()=>{void params.then(p=>setId(p.id))},[params]);
 useEffect(()=>{void fetch("/api/auth/session",{cache:"no-store"}).then(r=>r.json()).then(v=>setCanEdit(v.role==="ADMIN"||v.role==="EDITOR")).catch(()=>setCanEdit(false))},[]);
 const reload=useCallback(async()=>{if(!id)return;const r=await fetch("/api/audits/"+encodeURIComponent(id)+"/procedure/dialogue",{cache:"no-store"});
  const body=await r.json();if(!r.ok)throw Error(body.error??"Unable to load conversation");setData(body)},[id]);
 useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:"Unable to load conversation"))},[reload]);
 const choose=(q:Question)=>{setTarget(q.code);setKind("CLARIFICATION");setView("dialogue");setText("");setNotice("Clarifying "+q.code+": "+q.question)};
 const submit=async()=>{if(!data||text.trim().length<12)return;setBusy(true);setError("");setNotice("");
  try{const r=await fetch("/api/audits/"+encodeURIComponent(id)+"/procedure/dialogue",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({expectedRevision:data.audit.revision,text,kind,requirementCode:target})});
   const body=await r.json();if(!r.ok)throw Error(body.error??"Unable to record clarification");
   setText("");setTarget(null);setKind("PROCEDURE");setSemantic(null);
   await reload();setNotice("Recorded turn "+body.sequence+" as source material. No conformity decision was made.");
  }catch(e){setError(e instanceof Error?e.message:"Unable to record note")}finally{setBusy(false)}};
 const reasoned=async()=>{if(!data||data.transcript.length<40)return;setBusy(true);setError("");setSemantic(null);
  try{const r=await fetch("/api/audits/"+encodeURIComponent(id)+"/procedure/analyze",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({procedure:data.transcript,allowExternal:external})});
   const body=await r.json();if(!r.ok)throw Error(body.error??"Analysis failed");setSemantic(body);setView("coverage")
  }catch(e){setError(e instanceof Error?e.message:"Analysis failed")}finally{setBusy(false)}};
 const next=useMemo(()=>data?.nextQuestions??[],[data]);
 const editable=canEdit&&data?.audit.status!=="COMPLETED"&&(data?.turns.length??0)<30;
 return <main className="copilot-page">
  <header className="copilot-top"><div><Link className="management-return" href={"/audits/"+encodeURIComponent(id)+"/execute"}>Guided execution</Link>
   <p className="eyebrow">SURFACE AUDIT · CONVERSATIONAL PROCEDURE INTELLIGENCE</p>
   <h1>Explain your work. Build the audit together.</h1>
   <p>{data?.audit.title??"Audit copilot"} · {data?.audit.client??"Client"} · audit revision {data?.audit.revision??"—"}</p></div>
   <div className="copilot-links"><Link href={"/audits/"+encodeURIComponent(id)+"/procedure?from=dialogue"}>Review and populate audit sections</Link><Link href={"/reports/"+encodeURIComponent(id)}>Draft report</Link></div></header>
  <div className="storage-banner">Internal development assistant. Notes are stored locally and are not evidence of a completed procedure. AI processing is separately opt-in; the final assessment requires human verification and review.</div>
  {error&&<p role="alert" className="storage-error">{error} <button className="secondary" type="button" onClick={()=>void reload().catch(()=>{})}>Reload</button></p>}
  {notice&&<p role="status" className="storage-banner">{notice}</p>}
  {data&&<><section className="copilot-metrics">
   <div><span>Procedure turns</span><strong>{data.turns.length}/{data.limits.maxTurns}</strong></div>
   <div><span>Requirements mentioned</span><strong>{data.metrics.withPossibleNarrative}</strong></div>
   <div><span>Unmentioned requirements</span><strong>{data.metrics.unmentioned}</strong></div>
   <div><span>Possible gaps</span><strong>{data.metrics.apparentGaps}</strong></div>
  </section>
  <nav className="copilot-tabs" aria-label="Audit copilot views"><button type="button" className={view==="dialogue"?"active":""} onClick={()=>setView("dialogue")}>Procedure dialogue</button>
   <button type="button" className={view==="coverage"?"active":""} onClick={()=>setView("coverage")}>Requirement coverage ({data.coverage.length})</button></nav>
  <div className="copilot-layout"><section className="copilot-main">
   {view==="dialogue"?<>
    <div className="copilot-panel-head"><div><h2>Working procedure</h2><p>Every message is retained in order with the recording operator and audit history.</p></div>
     <button className="secondary" type="button" onClick={()=>void reload().catch(e=>setError(String(e)))} disabled={busy}>Refresh</button></div>
    {data.turns.length===0&&<div className="copilot-empty"><h3>Begin with the actual procedure you followed</h3><p>Explain the steps in your own words. Include the instrument, its identifiers, settings, measurements, criteria, results and gaps to the extent they were actually checked.</p></div>}
    <div className="copilot-timeline">{data.turns.map(turn=><article className="copilot-turn" key={turn.id}>
     <div><span className="copilot-seq">{turn.sequence}</span><strong>{turn.kind==="CLARIFICATION"?"Clarification":"Procedure observation"}</strong>
      {turn.requirementCode&&<small> · {turn.requirementCode}</small>}</div>
     <p>{turn.text}</p><small>Recorded by {turn.author} · {new Date(turn.createdAt).toLocaleString("en-GB")} · immutable note</small></article>)}</div>
    {editable&&<section className="copilot-compose"><h3>{target?"Follow up on "+target:"Add the next step or observation"}</h3>
     <label>What happened, what did you observe, or what remains to be done?
      <textarea rows={5} value={text} onChange={e=>setText(e.target.value)} maxLength={1800} disabled={busy}
       placeholder={target?"Explain what you actually checked. If the step was not done, say so and describe the next action.":"We followed procedure ... on instrument ... The reference certificate was ... We measured ... The outcome was ..."} /></label>
     {target&&<button type="button" className="secondary" onClick={()=>{setTarget(null);setKind("PROCEDURE");setNotice("")}}>Cancel specific follow-up</button>}
     <div className="copilot-compose-row"><span>{text.length} / 1,800 · {data.transcript.length} / {data.limits.maxCharacters} transcript characters</span>
      <button className="primary" type="button" onClick={()=>void submit()} disabled={busy||text.trim().length<12||data.transcript.length+text.trim().length+1>data.limits.maxCharacters}>{busy?"Saving…":"Record & update coverage"}</button></div></section>}
    {!editable&&<p className="copilot-hint">This dialogue is read-only for your role, completed audit or exhausted transcript limit.</p>}
   </>:<><div className="copilot-panel-head"><div><h2>Requirement evidence map</h2><p>Coverage describes the narrative, not proven compliance. Highlighted gaps require technical review.</p></div></div>
    {data.coverage.map(item=><article className="copilot-coverage" key={item.code}><div className="copilot-coverage-top"><strong>{item.code} · {item.title}</strong>
     <span className={"copilot-state "+item.coverage}>{readable(item.coverage)}</span></div>
     {item.excerpt&&<blockquote>{item.excerpt}</blockquote>}
     <p><b>Follow-up:</b> {item.followUp}</p><small>{item.sourceTurnIds.length?"Linked source turns: "+item.sourceTurnIds.length:"No narrative passage matched this requirement"}</small>
     {editable&&<button className="secondary" type="button" onClick={()=>choose({code:item.code,question:item.followUp,coverage:item.coverage})}>Add clarification for {item.code}</button>}</article>)}
    {semantic&&<section className="copilot-semantic"><h3>{semantic.mode==="model"?"AI model analysis":"Local word-matching analysis"} · {semantic.matches.length} suggestions</h3>
     {semantic.warning&&<p>{semantic.warning}</p>}
     {semantic.matches.map(m=><div key={m.code}><strong>{m.code}</strong><blockquote>{m.excerpt}</blockquote><p>{m.question}</p></div>)}</section>}
   </>}
  </section>
  <aside className="copilot-side"><h2>Next best questions</h2><p>These suggestions prioritize potential missing work, documentation gaps, and unmentioned checklist requirements.</p>
   {next.map(q=><button type="button" className="copilot-prompt" key={q.code} onClick={()=>choose(q)} disabled={!editable}>
    <strong>{q.code} · {readable(q.coverage)}</strong><span>{q.question}</span></button>)}
   {next.length===0&&<p>No unresolved questions in the current text. Continue to the original audit record and review all supporting evidence.</p>}
   <div className="copilot-divider"/>
   <h3>Deep interpretation</h3><p>Run fresh analysis of the entire conversation. Local matching needs no provider; external model analysis requires both server setup and your explicit permission.</p>
   <label className="copilot-optin"><input type="checkbox" checked={external} onChange={e=>setExternal(e.target.checked)}/> I authorize external AI processing of this current synthetic procedure transcript, if configured.</label>
   <button className="secondary" type="button" disabled={busy||data.transcript.length<40} onClick={()=>void reasoned()}>Analyze full conversation</button>
   <div className="copilot-divider"/>
   <h3>Populate the actual audit</h3><p>Send the assembled narrative to the protected review queue. Choose and edit only the relevant sections before saving. Nothing here automatically declares conformity.</p>
   <Link className="primary copilot-review-link" href={"/audits/"+encodeURIComponent(id)+"/procedure?from=dialogue"}>Review extracted audit entries</Link>
  </aside></div>
  <footer className="management-footer">The conversation is audit-scoped and append-only; every saved turn increments the audit revision and invalidates stale approvals. The transcript is not externally sent unless you opt into configured model processing. No external client data in this prototype.</footer>
  </>}
 </main>
}
