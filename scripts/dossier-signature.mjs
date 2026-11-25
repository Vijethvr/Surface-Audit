// Offline Ed25519 signatures for completed SURFACE Audit development dossiers.
// The private key stays OUTSIDE the app, database, repository and API process.
// Verify only against a public key independently trusted by the recipient.
import {createHash,createPrivateKey,createPublicKey,generateKeyPairSync,sign as signEd25519,verify as verifyEd25519} from "node:crypto";
import {existsSync,mkdirSync,readFileSync,statSync,writeFileSync,rmSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
import {verifyDossier} from "./verify-dossier.mjs";

const VERSION="surface-audit-signed-dossier-v1";
const CONTEXT=Buffer.from("SURFACE-AUDIT-ED25519-DOSSIER-v1\0","utf8");
const MAX_FILE=30*1024*1024;
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value!==null&&typeof value==="object"){
  return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
 }
 return value;
}
function payloadBytes(payload){return Buffer.concat([CONTEXT,Buffer.from(JSON.stringify(canonical(payload)),"utf8")])}
function sha(bytes){return createHash("sha256").update(bytes).digest("hex")}
function fingerprint(publicKey){
 return sha(publicKey.export({format:"der",type:"spki"}));
}
function readLimited(path){
 if(!existsSync(path)||statSync(path).size>MAX_FILE)throw Error("Missing or oversized input (limit 30 MiB)");
 return readFileSync(path);
}
function trustedKey(publicKeyPem){
 const key=createPublicKey(publicKeyPem);
 if(key.asymmetricKeyType!=="ed25519")throw Error("Trusted public key must use Ed25519");
 return key;
}
function ensureSealedDossier(dossier){
 const checked=verifyDossier(dossier);
 if(!checked.valid)throw Error("Unsigned dossier failed integrity checks: "+checked.failures.join("; "));
 if(dossier.reportIntegrity?.snapshot!==true||dossier.reportIntegrity?.verified!==true||
    dossier.report?.audit?.status!=="COMPLETED")
  throw Error("Only completed audits with verified stored report snapshots can be signed");
 if(dossier.report?.readiness?.ready!==true)throw Error("Audit closure readiness is not true");
 return checked;
}
export function signDossier(dossier,privatePem,passphrase,label){
 ensureSealedDossier(dossier);
 if(typeof label!=="string"||label.length<3||label.length>100||/[\r\n\x00-\x1f]/.test(label))
  throw Error("Signatory label must be 3–100 printable characters");
 if(typeof passphrase!=="string"||passphrase.length<20)throw Error("Passphrase required");
 const privateKey=createPrivateKey({key:privatePem,format:"pem",passphrase});
 if(privateKey.asymmetricKeyType!=="ed25519")throw Error("Expected an Ed25519 private key");
 const publicKey=createPublicKey(privateKey);
 const payload={
  formatVersion:VERSION,
  signerLabel:label,
  signedAt:new Date().toISOString(), // informational local clock, NOT a trusted timestamp
  publicKeyFingerprint:fingerprint(publicKey),
  dossier
 };
 const signature=signEd25519(null,payloadBytes(payload),privateKey).toString("base64");
 return {payload,signature:{algorithm:"Ed25519",valueBase64:signature}};
}
export function verifySignedDossier(envelope,publicPem){
 const errors=[];
 try{
  if(!envelope||typeof envelope!=="object"||Array.isArray(envelope))throw Error("Invalid envelope");
  if(Object.keys(envelope).sort().join(",")!=="payload,signature")throw Error("Unknown envelope structure");
  const p=envelope.payload,s=envelope.signature;
  if(!p||p.formatVersion!==VERSION||!s||s.algorithm!=="Ed25519"||
     typeof s.valueBase64!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(s.valueBase64))
   throw Error("Unsupported signed dossier format");
  if(typeof p.signerLabel!=="string"||p.signerLabel.length<3||p.signerLabel.length>100||
     typeof p.signedAt!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(p.signedAt))
   throw Error("Malformed signing metadata");
  const publicKey=trustedKey(publicPem);
  const derived=fingerprint(publicKey);
  if(derived!==p.publicKeyFingerprint)throw Error("Trusted public key fingerprint mismatch");
  if(!verifyEd25519(null,payloadBytes(p),publicKey,Buffer.from(s.valueBase64,"base64")))
   throw Error("Ed25519 signature failed verification");
  ensureSealedDossier(p.dossier);
  return {valid:true,errors:[],fingerprint:derived,auditId:p.dossier.auditId,signerLabel:p.signerLabel,signedAt:p.signedAt};
 }catch(error){errors.push(error instanceof Error?error.message:String(error))}
 return {valid:false,errors};
}
function writeNew(path,bytes,mode=0o600){
 writeFileSync(path,bytes,{flag:"wx",mode});
}
function cli(){
 const [command,...args]=process.argv.slice(2);
 if(command==="keygen"){
  const [dir]=args;
  if(!dir)throw Error("Usage: keygen <new-directory>");
  const passphrase=process.env.SURFACE_AUDIT_SIGNING_PASSPHRASE||"";
  if(passphrase.length<20||passphrase.length>1024)throw Error("Set SURFACE_AUDIT_SIGNING_PASSPHRASE (20–1024 characters) in the local process environment");
  if(existsSync(dir))throw Error("Key directory already exists. Refusing overwrite");
  const {privateKey,publicKey}=generateKeyPairSync("ed25519");
  const encryptedPrivate=privateKey.export({format:"pem",type:"pkcs8",cipher:"aes-256-cbc",passphrase});
  const pemPublic=publicKey.export({format:"pem",type:"spki"});
  try{
   mkdirSync(dir,{mode:0o700});
   writeNew(join(dir,"signing-private.encrypted.pem"),encryptedPrivate);
   writeNew(join(dir,"signing-public.pem"),pemPublic,0o644);
  }catch(error){rmSync(dir,{recursive:true,force:true});throw error}
  console.log("KEYGEN OK: public key fingerprint SHA-256:",fingerprint(publicKey));
  console.log("Keep private key and passphrase separate, secure and outside Git. Share PUBLIC key through an independent trusted channel.");
 }else if(command==="sign"){
  const [dossierPath,privatePath,outputPath,...labelParts]=args;
  if(!dossierPath||!privatePath||!outputPath||labelParts.length!==1)throw Error("Usage: sign <dossier.json> <encrypted-private.pem> <new-signed.json> <signer-label>");
  if(resolve(outputPath)===resolve(dossierPath)||resolve(outputPath)===resolve(privatePath)||existsSync(outputPath))
   throw Error("Output must be a NEW file; refusing overwrite");
  const passphrase=process.env.SURFACE_AUDIT_SIGNING_PASSPHRASE||"";
  const dossier=JSON.parse(readLimited(dossierPath).toString("utf8"));
  const signed=signDossier(dossier,readLimited(privatePath),passphrase,labelParts[0]);
  writeNew(outputPath,JSON.stringify(signed,null,2)+"\n");
  console.log("SIGN OK: audit",dossier.auditId,"public-key fingerprint",signed.payload.publicKeyFingerprint);
 }else if(command==="verify"){
  const [signedPath,publicPath]=args;
  if(!signedPath||!publicPath)throw Error("Usage: verify <signed.json> <independently-trusted-public.pem>");
  const signed=JSON.parse(readLimited(signedPath).toString("utf8"));
  const verified=verifySignedDossier(signed,readLimited(publicPath));
  if(!verified.valid)throw Error("VERIFY FAILED: "+verified.errors.join("; "));
  console.log("VERIFY OK:",JSON.stringify(verified));
  console.log("WARNING: Key ownership must be established independently. Signing date is not a trusted timestamp and verification is not an accredited approval.");
 }else{
  throw Error("Usage: node scripts/dossier-signature.mjs keygen <new-dir> | sign <dossier.json> <encrypted-private.pem> <new-signed.json> <signer-label> | verify <signed.json> <trusted-public.pem>");
 }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{cli()}catch(error){console.error("DOSSIER SIGNATURE:",error instanceof Error?error.message:String(error));process.exitCode=1}
}
