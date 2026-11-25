// Offline check of a SURFACE Audit development dossier.
// An internally consistent dossier is NOT a signed, independently authenticated record.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value!==null&&typeof value==="object")
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 return value;
}
function sha256(bytes){return createHash("sha256").update(bytes).digest("hex")}
function isHexHash(value){return typeof value==="string"&&/^[a-f0-9]{64}$/.test(value)}
export function verifyDossier(dossier){
 const failures=[];
 if(!dossier||typeof dossier!=="object"||dossier.formatVersion!=="surface-audit-dossier-v1")return {valid:false,failures:["Invalid dossier format"]};
 if(!dossier.report||typeof dossier.report!=="object")failures.push("Missing report object");
 if(!Array.isArray(dossier.assets))failures.push("Missing evidence file list");
 if(!isHexHash(dossier.reportSha256))failures.push("Invalid report hash");
 if(failures.length)return {valid:false,failures};
 const digest=sha256(Buffer.from(JSON.stringify(canonical(dossier.report))));
 if(digest!==dossier.reportSha256)failures.push("Report digest mismatch");
 if(dossier.report?.audit?.id!==dossier.auditId)failures.push("Report and dossier audit identifiers differ");
 if(dossier.reportIntegrity?.snapshot){
  if(dossier.reportIntegrity.sha256!==dossier.reportSha256)failures.push("Sealed snapshot hash differs from report");
  if(dossier.reportIntegrity.verified!==true)failures.push("Sealed snapshot was not verified when exported");
 }
 const expected=new Map();
 for(const req of dossier.report.requirements||[]){
  for(const file of req.evidenceFiles||[]){
   if(expected.has(file.id))failures.push("Duplicate evidence metadata: "+file.id);
   expected.set(file.id,file);
  }
 }
 const seen=new Set();
 for(const file of dossier.assets){
  if(!file||typeof file.id!=="string"||!isHexHash(file.sha256)||typeof file.base64!=="string"||
     !Number.isSafeInteger(file.sizeBytes)||file.sizeBytes<1){
   failures.push("Malformed evidence entry");continue;
  }
  if(seen.has(file.id))failures.push("Duplicate attached evidence: "+file.id);
  seen.add(file.id);
  const raw=Buffer.from(file.base64,"base64");
  if(raw.toString("base64")!==file.base64)failures.push("Invalid base64 bytes: "+file.id);
  if(raw.length!==file.sizeBytes)failures.push("Evidence size mismatch: "+file.id);
  if(sha256(raw)!==file.sha256)failures.push("Evidence digest mismatch: "+file.id);
  const req=expected.get(file.id);
  if(!req)failures.push("Evidence missing from report manifest: "+file.id);
  else if(req.sha256!==file.sha256||req.sizeBytes!==file.sizeBytes||req.filename!==file.filename||
    req.mimeType!==file.mimeType||!dossier.report.requirements.some(r=>r.code===file.requirementCode&&
       (r.evidenceFiles||[]).some(a=>a.id===file.id)))
   failures.push("Evidence report manifest mismatch: "+file.id);
 }
 for(const id of expected.keys())if(!seen.has(id))failures.push("Missing evidence content: "+id);
 return {valid:failures.length===0,failures,reportSha256:digest,evidenceCount:dossier.assets.length};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const filename=process.argv[2];
 if(!filename){console.error("Usage: node scripts/verify-dossier.mjs <dossier.json>");process.exitCode=2}
 else{
  try{
   const value=JSON.parse(readFileSync(filename,"utf8"));
   const verdict=verifyDossier(value);
   if(verdict.valid)console.log("PASS: report and "+verdict.evidenceCount+" evidence file checksums match the embedded manifest. This is NOT an independent signature.");
   else{console.error("FAIL:\n"+verdict.failures.join("\n"));process.exitCode=1}
  }catch(err){console.error("FAIL:",err);process.exitCode=1}
 }
}
