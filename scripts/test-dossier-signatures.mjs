// Full offline acceptance tests using a sealed dossier exported by the HTTP test.
// Generates only temporary, disposable CI keys. Never commits signing secrets.
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {verifySignedDossier,signDossier} from "./dossier-signature.mjs";
import {keyFingerprint,verifyWithRegistry} from "./trusted-signers.mjs";
import {verifyDossier} from "./verify-dossier.mjs";
const sample=process.argv[2];
if(process.env.CI!=="true"||!sample)throw Error("CI-only test expects path to exported sealed dossier");
const dossier=JSON.parse(readFileSync(sample,"utf8"));
assert.equal(verifyDossier(dossier).valid,true);
const dir=mkdtempSync(join(tmpdir(),"surface-signing-"));
const script=resolve("scripts/dossier-signature.mjs");
const passphrase="CI-only-offline-signature-encryption-passphrase-2026";
const env={...process.env,SURFACE_AUDIT_SIGNING_PASSPHRASE:passphrase};
function run(args,settings={}){
 return spawnSync(process.execPath,[script,...args],{env:{...env,...settings},encoding:"utf8",timeout:20000});
}
function mustSucceed(args,settings={}){
 const output=run(args,settings);
 assert.equal(output.status,0,(output.stdout||"")+"\n"+(output.stderr||""));
 return output;
}
function mustFail(args,settings={}){
 const output=run(args,settings);
 assert.notEqual(output.status,0,"Operation should fail: "+args.join(" "));
 return output;
}
function canonical(obj){
 if(Array.isArray(obj))return obj.map(canonical);
 if(obj&&typeof obj==="object")return Object.fromEntries(Object.keys(obj).sort().map(k=>[k,canonical(obj[k])]));
 return obj;
}
const hash=obj=>createHash("sha256").update(JSON.stringify(canonical(obj))).digest("hex");
try{
 const a=join(dir,"identity-a"),b=join(dir,"identity-b");
 const signedPath=join(dir,"signed.json"),tamperedPath=join(dir,"tampered.json");
 const privatePath=join(a,"signing-private.encrypted.pem"),pub=join(a,"signing-public.pem");
 mustSucceed(["keygen",a]);
 mustSucceed(["keygen",b]);
 mustFail(["keygen",a]); // never replace a previously established identity
 mustSucceed(["sign",sample,privatePath,signedPath,"CI independent reviewer"]);
 const signed=JSON.parse(readFileSync(signedPath,"utf8"));
 assert.equal(signed.payload.dossier.auditId,dossier.auditId);
 assert.equal(verifySignedDossier(signed,readFileSync(pub)).valid,true);
 mustSucceed(["verify",signedPath,pub]);
 mustFail(["verify",signedPath,join(b,"signing-public.pem")]);
 mustFail(["sign",sample,privatePath,join(dir,"wrong-pass.json"),"CI independent reviewer"],{SURFACE_AUDIT_SIGNING_PASSPHRASE:"incorrect-but-still-long-passphrase"});
 mustFail(["sign",sample,privatePath,signedPath,"CI independent reviewer"]); // no overwrite
 const changedReport=structuredClone(signed);
 changedReport.payload.dossier.report.summary="Changed by attacker";
 // Even an attacker who recomputes unsigned checksums cannot forge the signature.
 changedReport.payload.dossier.reportSha256=hash(changedReport.payload.dossier.report);
 changedReport.payload.dossier.reportIntegrity.sha256=changedReport.payload.dossier.reportSha256;
 writeFileSync(tamperedPath,JSON.stringify(changedReport));
 assert.equal(verifySignedDossier(changedReport,readFileSync(pub)).valid,false);
 mustFail(["verify",tamperedPath,pub]);
 const changedEvidence=structuredClone(signed);
 changedEvidence.payload.dossier.assets[0].base64=Buffer.from("attacker substituted file").toString("base64");
 const tamperedEvidencePath=join(dir,"evidence-tamper.json");
 writeFileSync(tamperedEvidencePath,JSON.stringify(changedEvidence));
 mustFail(["verify",tamperedEvidencePath,pub]);
 const changedLabel=structuredClone(signed);
 changedLabel.payload.signerLabel="Fake accredited approval";
 assert.equal(verifySignedDossier(changedLabel,readFileSync(pub)).valid,false);
 const missingAsset=structuredClone(signed);
 missingAsset.payload.dossier.assets=[];
 assert.equal(verifySignedDossier(missingAsset,readFileSync(pub)).valid,false);
 const fakeDraft=structuredClone(dossier);
 fakeDraft.reportIntegrity.snapshot=false;
 assert.throws(()=>signDossier(fakeDraft,readFileSync(privatePath),passphrase,"CI independent reviewer"));
 // v1.8: explicit out-of-band fingerprint pinning and irrevocable local revocation.
 const registry=join(dir,"trusted-signers.json");
 const trustScript=resolve("scripts/trusted-signers.mjs");
 function trust(args){
  return spawnSync(process.execPath,[trustScript,...args],{env,encoding:"utf8",timeout:20000});
 }
 function trustPass(args){const result=trust(args);assert.equal(result.status,0,result.stderr||result.stdout)}
 function trustFail(args){const result=trust(args);assert.notEqual(result.status,0,"Expected trust policy rejection: "+args.join(" "))}
 trustPass(["init",registry]);
 trustFail(["init",registry]);
 const fingerprint=keyFingerprint(readFileSync(pub));
 trustFail(["enroll",registry,pub,"CI reviewer","--confirm="+("0".repeat(64))]);
 trustFail(["verify",registry,signedPath]); // No trusted key enrolled.
 trustPass(["enroll",registry,pub,"CI reviewer","--confirm="+fingerprint]);
 const enrolledRegistry=JSON.parse(readFileSync(registry,"utf8"));
 assert.equal(verifyWithRegistry(enrolledRegistry,signed).valid,true);
 trustPass(["verify",registry,signedPath]);
 trustFail(["enroll",registry,pub,"duplicate reviewer","--confirm="+fingerprint]);
 trustFail(["verify",registry,tamperedPath]);
 trustFail(["verify",registry,tamperedEvidencePath]);
 trustPass(["revoke",registry,fingerprint,"Private key no longer trusted"]);
 trustFail(["verify",registry,signedPath]);
 trustFail(["enroll",registry,pub,"re-add revoked key","--confirm="+fingerprint]);
 trustFail(["revoke",registry,fingerprint,"repeated revocation"]);
 assert.equal(verifyWithRegistry(JSON.parse(readFileSync(registry,"utf8")),signed).valid,false);
 console.log("PASS: out-of-band pinned key enrollment, unknown key rejection, forged signature rejection and key revocation");
 console.log("PASS: real sealed dossier signed, independently verified and rejected under wrong key/passphrase, tampered report/evidence/label, unsigned draft and overwrite attempts");
}finally{rmSync(dir,{recursive:true,force:true})}
