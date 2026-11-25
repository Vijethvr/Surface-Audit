"use client";
import {FormEvent,useCallback,useEffect,useState} from "react";
import {Download,FileUp,RefreshCw,ShieldCheck} from "lucide-react";
type Requirement={id:string;title:string};
type Asset={id:string;requirementCode:string;filename:string;mimeType:string;sizeBytes:number;sha256:string;uploadedBy:string;createdAt:string};
export default function EvidenceVault({auditId,requirements}:{auditId:string;requirements:Requirement[]}){
 const [assets,setAssets]=useState<Asset[]>([]);
 const [code,setCode]=useState(requirements[0]?.id||"");
 const [file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [limit,setLimit]=useState(1048576);
 const root="/api/audits/"+encodeURIComponent(auditId)+"/assets";
 const load=useCallback(async()=>{
  const r=await fetch(root,{cache:"no-store"});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||"Unable to retrieve evidence files");
  setAssets(data.assets);
  setLimit(data.maxEvidenceBytes);
 },[root]);
 useEffect(()=>{void load().catch(e=>setError(String(e)))},[load]);
 async function submit(e:FormEvent){
  e.preventDefault();
  if(!file)return;
  if(file.size>limit){setError("File exceeds the 1 MiB limit");return}
  setBusy(true);setError("");setMessage("");
  try{
   const form=new FormData();form.append("file",file);form.append("requirementCode",code);
   const response=await fetch(root,{method:"POST",body:form});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Upload rejected");
   setFile(null);const input=document.getElementById("evidence-file-"+auditId) as HTMLInputElement|null;if(input)input.value="";
   await load();setMessage("File saved with a SHA-256 digest. Document authenticity has not been verified.");
  }catch(err){setError(err instanceof Error?err.message:"Upload failed")}finally{setBusy(false)}
 }
 return <div className="evidence-vault">
  <div className="panelhead"><div><h2>Local evidence file vault</h2><p>PDF, PNG, JPEG, TXT · 1 MiB per file · 40 files per audit · development only</p></div>
   <button className="secondary" type="button" disabled={busy} onClick={()=>void load().catch(e=>setError(String(e)))}><RefreshCw size={14}/> Refresh</button></div>
  <p className="registry-info">Files are stored in the local PostgreSQL development database. Checksums detect accidental changes, not document authenticity, malware, calibrated traceability, or independent approval. Never upload confidential client files.</p>
  <form className="vault-upload" onSubmit={submit}>
   <label>Requirement<select required value={code} onChange={e=>setCode(e.target.value)}>{requirements.map(r=><option value={r.id} key={r.id}>{r.id} · {r.title}</option>)}</select></label>
   <label>Evidence file<input id={"evidence-file-"+auditId} required type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <button className="primary" disabled={busy||!file||assets.length>=40} type="submit"><FileUp size={16}/>{busy?"Uploading…":"Attach file"}</button>
  </form>
  {error&&<p className="storage-error" role="alert">{error}</p>}
  {message&&<p className="storage-banner" role="status">{message}</p>}
  {assets.length===0?<p className="registry-empty">No evidence files attached yet.</p>:<div className="vault-files">{assets.map(a=><article key={a.id}>
   <div><b>{a.requirementCode} · {a.filename}</b><small>{(a.sizeBytes/1024).toFixed(1)} KiB · {a.mimeType} · {new Date(a.createdAt).toLocaleString("en-GB")}</small><code>SHA-256: {a.sha256}</code></div>
   <a className="secondary vault-download" href={root+"/"+encodeURIComponent(a.id)}><Download size={15}/> Download</a>
  </article>)}</div>}
  <p className="registry-info"><ShieldCheck size={13}/> Downloads are hash-checked and served as attachments, not displayed inline.</p>
 </div>;
}
