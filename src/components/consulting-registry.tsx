"use client";
import {FormEvent,useEffect,useState} from "react";
import {Building2,FolderKanban,Gauge,ClipboardList,Plus,RefreshCw} from "lucide-react";
type Client={id:string;name:string;_count:{audits:number;projects:number}};
type Project={id:string;name:string;reference:string|null;client:{name:string};clientId:string};
type Instrument={id:string;identifier:string;name:string;instrumentType:string;manufacturer:string|null;calibrationReference:string|null;calibrationDue:string|null};
type Template={id:string;title:string;description:string|null;revision:string;criteria:unknown};
type RegistryKind="Clients & Projects"|"Equipment & Traceability"|"Audit Templates";
const demoOnly="This module requires local PostgreSQL mode and operator sign-in. Do not enter confidential client data.";
export default function ConsultingRegistry({kind}:{kind:RegistryKind}){
 const enabled=process.env.NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE==="postgres";
 const [clients,setClients]=useState<Client[]>([]);const [projects,setProjects]=useState<Project[]>([]);
 const [equipment,setEquipment]=useState<Instrument[]>([]);const [templates,setTemplates]=useState<Template[]>([]);
 const [name,setName]=useState("");const [parent,setParent]=useState("");
 const [secondary,setSecondary]=useState("");const [third,setThird]=useState("");
 const [due,setDue]=useState("");const [criteria,setCriteria]=useState("");
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [loading,setLoading]=useState(false);const [creating,setCreating]=useState(false);
 const [form,setForm]=useState<"client"|"project"|"equipment"|"template">("client");
 useEffect(()=>{setForm(kind==="Clients & Projects"?"client":kind==="Equipment & Traceability"?"equipment":"template");setName("");setSecondary("");setThird("");setCriteria("");setDue("");setError("");setNotice("")},[kind]);
 async function request(path:string,options?:RequestInit){
  const r=await fetch("/api/"+path,{cache:"no-store",...options});let payload:Record<string,unknown>;
  try{payload=await r.json()}catch{throw Error("Unexpected server response")}
  if(!r.ok)throw Error(typeof payload.error==="string"?payload.error:"Request failed");
  return payload;
 }
 async function refresh(){
  if(!enabled)return;
  setLoading(true);setError("");
  try{
   if(kind==="Clients & Projects"){
    const [c,p]=await Promise.all([request("clients"),request("projects")]);
    setClients(c.clients as Client[]);setProjects(p.projects as Project[]);
   } else if(kind==="Equipment & Traceability")setEquipment((await request("equipment")).equipment as Instrument[]);
   else setTemplates((await request("templates")).templates as Template[]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load records")}finally{setLoading(false)}
 }
 useEffect(()=>{void refresh()},[kind,enabled]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!enabled)return;setCreating(true);setError("");setNotice("");
  try{
   let endpoint:string;let payload:Record<string,unknown>;
   if(form==="client"){endpoint="clients";payload={name}}
   else if(form==="project"){endpoint="projects";payload={name,clientId:parent,reference:secondary}}
   else if(form==="equipment"){endpoint="equipment";payload={identifier:name,name:secondary,instrumentType:third,calibrationDue:due||null}}
   else{
    const rows=criteria.split("\n").map((text,i)=>({code:"REQ-"+String(i+1).padStart(2,"0"),text:text.trim()})).filter(x=>x.text);
    endpoint="templates";payload={title:name,description:secondary,revision:third||"1.0",criteria:rows};
   }
   await request(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   setName("");setSecondary("");setThird("");setDue("");setCriteria("");
   setNotice("Record created in the local development database.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to create record")}finally{setCreating(false)}
 }
 const titles={"Clients & Projects":"Consulting clients and assignments","Equipment & Traceability":"Equipment and calibration register","Audit Templates":"Controlled audit template drafts"};
 return <section className="registry">
 <div className="panel registry-intro"><div className="registry-title"><div><h2>{titles[kind]}</h2><p>Consulting workspace · local-development records only</p></div><button type="button" className="secondary" disabled={!enabled||loading} onClick={()=>void refresh()}><RefreshCw size={16}/> Refresh</button></div>
 {!enabled&&<p className="storage-banner">{demoOnly}</p>}
 {enabled&&<p className="registry-info">Authenticated development storage. These records are not yet approved, version-controlled compliance evidence.</p>}
 {error&&<p className="storage-error" role="alert">{error}</p>}{notice&&<p className="storage-banner" role="status">{notice}</p>}</div>
 <div className="registry-layout">
 <div className="panel">
 <div className="panelhead"><div><h2>{kind==="Clients & Projects"?"Client and project register":kind==="Equipment & Traceability"?"Instrument inventory":"Reusable templates"}</h2><p>{loading?"Loading records…":"Records stored in PostgreSQL development mode"}</p></div></div>
 {kind==="Clients & Projects"?<>
 <p className="registry-info"><a href="/engagements">Open Engagement Studio — client delivery overview and handoff packs</a></p><div className="registry-subheading"><Building2 size={17}/> Clients ({clients.length})</div>
 {clients.length===0?<p className="registry-empty">No clients have been created yet.</p>:<div className="registry-items">{clients.map(c=><article key={c.id}><b>{c.name}</b><small>{c._count.audits} audits · {c._count.projects} projects</small></article>)}</div>}
 <div className="registry-subheading"><FolderKanban size={17}/> Projects ({projects.length})</div>
 {projects.length===0?<p className="registry-empty">No projects have been created yet.</p>:<div className="registry-items">{projects.map(p=><article key={p.id}><b>{p.name}</b><small>{p.client.name}{p.reference?" · "+p.reference:""}</small></article>)}</div>}
 </>:kind==="Equipment & Traceability"?<>
 {equipment.length===0?<p className="registry-empty">No instruments registered yet.</p>:<div className="registry-items">{equipment.map(m=><article key={m.id}><b>{m.identifier} · {m.name}</b><small>{m.instrumentType} · {m.calibrationDue?"Due "+new Date(m.calibrationDue).toLocaleDateString("en-GB"):"Calibration due date not recorded"}</small></article>)}</div>}
 </>:<>
 {templates.length===0?<p className="registry-empty">No audit templates created yet.</p>:<div className="registry-items">{templates.map(t=><article key={t.id}><b>{t.title}</b><small>Revision {t.revision} · {Array.isArray(t.criteria)?t.criteria.length:0} requirements · Draft</small></article>)}</div>}
 </>}
 </div>
 <aside className="panel"><div className="panelhead"><div><h2>Create a record</h2><p>Complete the fields below to add an entry</p></div><Plus size={19}/></div>
 {kind==="Clients & Projects"&&<div className="registry-toggle"><button className={form==="client"?"active":""} type="button" onClick={()=>setForm("client")}>Client</button><button className={form==="project"?"active":""} type="button" onClick={()=>setForm("project")}>Project</button></div>}
 <form className="registry-form" onSubmit={submit}>
 <label>{form==="equipment"?"Instrument identifier":form==="template"?"Template title":form==="project"?"Project title":"Client name"}<input required disabled={!enabled} maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder={form==="equipment"?"MET-001":form==="template"?"Measurement assurance review":form==="project"?"Supplier measurement audit":"Client organization"}/></label>
 {form==="project"&&<label>Client<select required disabled={!enabled} value={parent} onChange={e=>setParent(e.target.value)}><option value="">Choose client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
 {form==="project"&&<label>Project reference (optional)<input disabled={!enabled} value={secondary} onChange={e=>setSecondary(e.target.value)} maxLength={100}/></label>}
 {form==="equipment"&&<><label>Instrument name<input required disabled={!enabled} value={secondary} onChange={e=>setSecondary(e.target.value)} placeholder="Contact stylus profilometer"/></label><label>Instrument type<input required disabled={!enabled} value={third} onChange={e=>setThird(e.target.value)} placeholder="Profilometer"/></label><label>Calibration due date (optional)<input type="date" disabled={!enabled} value={due} onChange={e=>setDue(e.target.value)}/></label></>}
 {form==="template"&&<><label>Description<input disabled={!enabled} value={secondary} onChange={e=>setSecondary(e.target.value)} maxLength={1000}/></label><label>Revision<input disabled={!enabled} value={third} onChange={e=>setThird(e.target.value)} placeholder="1.0" maxLength={40}/></label><label>Requirements (one per line)<textarea rows={6} required disabled={!enabled} value={criteria} onChange={e=>setCriteria(e.target.value)} placeholder={"Measurement procedure identified\nCalibration evidence reviewed\nDecision rule documented"}/></label></>}
 <button className="primary" type="submit" disabled={!enabled||creating||loading}><Plus size={16}/>{creating?"Saving…":"Create "+form}</button></form>
 </aside></div></section>
}
