// Offline trust registry for Ed25519 dossier public keys.
// Public keys MUST be authenticated through an independent channel before enrollment.
// This registry is a LOCAL POLICY FILE, not a CA, revocation authority, or trusted timestamp.
import {createHash,createPublicKey} from "node:crypto";
import {existsSync,readFileSync,writeFileSync,renameSync,rmSync,statSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {randomBytes} from "node:crypto";
import {fileURLToPath} from "node:url";
import {verifySignedDossier} from "./dossier-signature.mjs";

const version="surface-audit-trusted-keys-v1";
const MAX_REGISTRY=1_000_000;
const MAX_DOSSIER=30*1024*1024;
export function keyFingerprint(pem){
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("Expected an Ed25519 public key");
 return createHash("sha256").update(key.export({format:"der",type:"spki"})).digest("hex");
}
function validateRegistry(data){
 if(!data||typeof data!=="object"||Array.isArray(data)||data.formatVersion!==version||!Array.isArray(data.keys))throw Error("Invalid local trust registry");
 if(data.keys.length>1000)throw Error("Too many registry keys");
 const seen=new Set();
 for(const item of data.keys){
  if(!item||typeof item!=="object"||typeof item.publicKeyPem!=="string"||
    typeof item.fingerprint!=="string"||!/^[a-f0-9]{64}$/.test(item.fingerprint)||
    !["TRUSTED","REVOKED"].includes(item.status)||typeof item.label!=="string"||
    item.label.length<3||item.label.length>100||typeof item.enrolledAt!=="string")throw Error("Invalid trust registry entry");
  if(keyFingerprint(item.publicKeyPem)!==item.fingerprint)throw Error("Registry contains a mismatched public key");
  if(seen.has(item.fingerprint))throw Error("Duplicate key in registry");
  seen.add(item.fingerprint);
 }
 return data;
}
function readRegistry(path){
 if(!existsSync(path)||statSync(path).size>MAX_REGISTRY)throw Error("Registry missing or too large");
 return validateRegistry(JSON.parse(readFileSync(path,"utf8")));
}
function writeNew(path,data){writeFileSync(path,JSON.stringify(data,null,2)+"\n",{flag:"wx",mode:0o600})}
function update(path,data){
 validateRegistry(data);
 const temp=join(dirname(path),"."+randomBytes(12).toString("hex")+".tmp");
 try{
  writeNew(temp,data);
  renameSync(temp,path);
 }finally{if(existsSync(temp))rmSync(temp)}
}
function printable(value,what){
 if(typeof value!=="string"||value.trim().length<3||value.length>100||/[\x00-\x1f]/.test(value))throw Error(what+" must be 3–100 printable characters");
 return value.trim();
}
export function verifyWithRegistry(registry,envelope){
 const data=validateRegistry(registry);
 const fingerprint=envelope?.payload?.publicKeyFingerprint;
 const entry=data.keys.find(item=>item.fingerprint===fingerprint);
 if(!entry)return {valid:false,errors:["Signer key is not enrolled in trusted registry"]};
 if(entry.status!=="TRUSTED")return {valid:false,errors:["Signer key has been locally revoked"]};
 const result=verifySignedDossier(envelope,entry.publicKeyPem);
 if(!result.valid)return result;
 return {...result,trustedLabel:entry.label,registryStatus:entry.status};
}
function cli(){
 const [cmd,...args]=process.argv.slice(2);
 if(cmd==="init"){
  const [path]=args;
  if(!path||existsSync(path))throw Error("Use init <new-registry.json>; existing files are never overwritten");
  writeNew(path,{formatVersion:version,createdAt:new Date().toISOString(),warning:"LOCAL TRUST POLICY ONLY — independently authenticate each key and protect this file",keys:[]});
  console.log("TRUST REGISTRY CREATED:",resolve(path));
 }else if(cmd==="fingerprint"){
  const [keyPath]=args;
  if(!keyPath)throw Error("Usage: fingerprint <public.pem>");
  console.log(keyFingerprint(readFileSync(keyPath)));
 }else if(cmd==="enroll"){
  const [path,keyPath,label,confirmation]=args;
  if(!path||!keyPath||!confirmation?.startsWith("--confirm="))throw Error("Usage: enroll <registry.json> <public.pem> <label> --confirm=<independently-verified-fingerprint>");
  const data=readRegistry(path);
  const key=readFileSync(keyPath,"utf8");
  const fingerprint=keyFingerprint(key);
  if(confirmation!=="--confirm="+fingerprint)throw Error("Public key fingerprint was not independently confirmed");
  if(data.keys.some(k=>k.fingerprint===fingerprint))throw Error("Key was already enrolled; revocation cannot be undone via enrollment");
  data.keys.push({fingerprint,publicKeyPem:key,label:printable(label,"Label"),status:"TRUSTED",enrolledAt:new Date().toISOString(),revokedAt:null,revocationReason:null});
  update(path,data);
  console.log("ENROLLED:",fingerprint,"—",label);
 }else if(cmd==="revoke"){
  const [path,fingerprint,reason]=args;
  const data=readRegistry(path);
  const item=data.keys.find(k=>k.fingerprint===fingerprint);
  if(!item)throw Error("Key not enrolled");
  if(item.status==="REVOKED")throw Error("Key was already revoked");
  item.status="REVOKED";item.revokedAt=new Date().toISOString();item.revocationReason=printable(reason,"Revocation reason");
  update(path,data);
  console.log("REVOKED:",fingerprint);
 }else if(cmd==="verify"){
  const [path,signedPath]=args;
  if(!path||!signedPath)throw Error("Usage: verify <registry.json> <signed-dossier.json>");
  if(!existsSync(signedPath)||statSync(signedPath).size>MAX_DOSSIER)throw Error("Signed dossier missing or oversized");
  const result=verifyWithRegistry(readRegistry(path),JSON.parse(readFileSync(signedPath,"utf8")));
  if(!result.valid)throw Error("Policy verification failed: "+result.errors.join("; "));
  console.log("TRUST VERIFICATION OK:",JSON.stringify(result));
  console.log("CAUTION: This is local key policy only. The registry can be modified by whoever controls its file; signing time and real-world identity are not independently verified.");
 }else if(cmd==="list"){
  const [path]=args;
  if(!path)throw Error("Usage: list <registry.json>");
  console.log(JSON.stringify(readRegistry(path).keys.map(({fingerprint,label,status,enrolledAt,revokedAt,revocationReason})=>({fingerprint,label,status,enrolledAt,revokedAt,revocationReason})),null,2));
 }else throw Error("Usage: node scripts/trusted-signers.mjs init|fingerprint|enroll|revoke|verify|list ...");
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{cli()}catch(err){console.error("TRUST POLICY ERROR:",err instanceof Error?err.message:String(err));process.exitCode=1}
}
