#!/usr/bin/env node
// Offline integrity check for local development portable project packages.
// SHA-256 cannot prove authorship, approval, timestamp authenticity or trust.
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
function canonical(value){
 if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
 if(value&&typeof value==="object")
  return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
 return JSON.stringify(value);
}
export function verifyPackage(pkg){
 if(!pkg||typeof pkg!=="object"||pkg.format!=="surface-audit-project-pack-v1"||
  pkg.hashAlgorithm!=="SHA-256"||!pkg.content||typeof pkg.content!=="object"||
  typeof pkg.contentSha256!=="string"||!/^[a-f0-9]{64}$/.test(pkg.contentSha256))
  return {valid:false,reason:"Invalid package envelope"};
 const actual=createHash("sha256").update(canonical(pkg.content)).digest("hex");
 if(actual!==pkg.contentSha256)return {valid:false,reason:"Content digest mismatch"};
 if(pkg.content.scope?.complete!==true||pkg.content.readiness?.ready!==true)
  return {valid:false,reason:"Package marked incomplete or not ready"};
 return {valid:true,sha256:actual,project:pkg.content.project?.name??"Unknown project",
  warning:"Digest only: not proof of trusted origin, client consent, contractual acceptance, or signature"};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 try{
  const file=process.argv[2];
  if(!file)throw Error("Usage: node scripts/verify-project-pack.mjs <exported-project-pack.json>");
  const pkg=JSON.parse(readFileSync(file,"utf8"));
  const result=verifyPackage(pkg);
  console.log(JSON.stringify(result,null,2));
  if(!result.valid)process.exitCode=2;
 }catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=2}
}
