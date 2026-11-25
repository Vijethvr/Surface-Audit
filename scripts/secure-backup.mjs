// Development-only encrypted backup packaging. AES-256-GCM + scrypt.
// This DOES NOT create a database backup; run local-recovery.mjs backup first.
// Never auto-removes plaintext archives. Keep passphrase out of logs and source control.
import {createCipheriv,createDecipheriv,randomBytes,scryptSync,timingSafeEqual} from "node:crypto";
import {existsSync,mkdirSync,openSync,closeSync,readFileSync,statSync,writeFileSync,rmSync} from "node:fs";
import {resolve,join} from "node:path";
const [action,sourceDir,targetDir]=process.argv.slice(2);
const help="Usage: SURFACE_AUDIT_BACKUP_PASSPHRASE=<secret> node scripts/secure-backup.mjs seal|unseal <existing-input-dir> <new-output-dir>";
if(!["seal","unseal"].includes(action)||!sourceDir||!targetDir)throw Error(help);
if(process.env.NODE_ENV==="production")throw Error("Development-only backup tool: production use refused");
const password=process.env.SURFACE_AUDIT_BACKUP_PASSPHRASE||"";
if(password.length<20||password.length>1024)throw Error("Backup passphrase must be 20–1024 characters; provide it through the process environment, not CLI arguments.");
const input=resolve(sourceDir),out=resolve(targetDir);
if(input===out||out.startsWith(input+"/")||out.startsWith(input+"\\")||input.startsWith(out+"/")||input.startsWith(out+"\\"))throw Error("Source and destination directories must be separate");
if(existsSync(out))throw Error("Destination already exists; use a fresh directory");
const max=256*1024*1024;
const magic=Buffer.from("SURFAUD1");
function key(salt){return scryptSync(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024})}
function pack(files){
 const meta=Buffer.from(JSON.stringify({version:1,files:files.map(([name,bytes])=>({name,length:bytes.length}))}),"utf8");
 const len=Buffer.alloc(4);len.writeUInt32BE(meta.length);
 return Buffer.concat([len,meta,...files.map(([,bytes])=>bytes)]);
}
function unpack(plaintext){
 if(plaintext.length<4)throw Error("Invalid decrypted payload");
 const size=plaintext.readUInt32BE(0);
 if(size>4096||size<10||plaintext.length<4+size)throw Error("Invalid decrypted metadata");
 const metadata=JSON.parse(plaintext.subarray(4,4+size).toString("utf8"));
 if(metadata.version!==1||!Array.isArray(metadata.files)||metadata.files.length!==2||
    metadata.files.map(f=>f.name).join(",")!=="manifest.json,surface-audit.backup")throw Error("Unsupported backup payload");
 let at=4+size;
 const files=[];
 for(const item of metadata.files){
  if(!Number.isSafeInteger(item.length)||item.length<1||at+item.length>plaintext.length)throw Error("Invalid file length");
  files.push([item.name,plaintext.subarray(at,at+item.length)]);at+=item.length;
 }
 if(at!==plaintext.length)throw Error("Trailing decrypted payload bytes");
 return files;
}
try{
 let result;
 if(action==="seal"){
  const archive=join(input,"surface-audit.backup"),manifest=join(input,"manifest.json");
  if(!existsSync(archive)||!existsSync(manifest))throw Error("Source must contain a verified PostgreSQL backup and manifest.json");
  if(statSync(archive).size>max)throw Error("Archive exceeds the 256 MiB development encryption limit");
  const plaintext=pack([["manifest.json",readFileSync(manifest)],["surface-audit.backup",readFileSync(archive)]]);
  const salt=randomBytes(16),iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key(salt),iv);
  cipher.setAAD(magic);
  const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const tag=cipher.getAuthTag();
  mkdirSync(out,{recursive:false,mode:0o700});
  writeFileSync(join(out,"surface-audit.vault"),Buffer.concat([magic,salt,iv,tag,ciphertext]),{flag:"wx",mode:0o600});
  result={action,bytes:ciphertext.length,output:out};
 }else{
  const vault=join(input,"surface-audit.vault");
  if(!existsSync(vault)||statSync(vault).size>max+8192||statSync(vault).size<60)throw Error("Missing, oversized or invalid encrypted archive");
  const blob=readFileSync(vault);
  if(!timingSafeEqual(blob.subarray(0,8),magic))throw Error("Invalid backup envelope");
  const salt=blob.subarray(8,24),iv=blob.subarray(24,36),tag=blob.subarray(36,52);
  const cipher=createDecipheriv("aes-256-gcm",key(salt),iv);
  cipher.setAAD(magic);cipher.setAuthTag(tag);
  let contents;
  try{contents=Buffer.concat([cipher.update(blob.subarray(52)),cipher.final()])}
  catch{throw Error("Wrong passphrase or encrypted archive failed authentication")}
  const files=unpack(contents);
  mkdirSync(out,{recursive:false,mode:0o700});
  for(const [name,bytes] of files)writeFileSync(join(out,name),bytes,{flag:"wx",mode:0o600});
  result={action,output:out,files:files.map(([name])=>name)};
 }
 console.log("SECURE BACKUP OK:",JSON.stringify(result));
 console.log("CAUTION: This tool never deletes any source or plaintext archive; protect and securely dispose of any copies separately.");
}catch(error){
 if(existsSync(out)){try{rmSync(out,{recursive:true,force:true})}catch{}}
 console.error("SECURE BACKUP FAILED:",error instanceof Error?error.message:String(error));
 process.exitCode=1;
}
