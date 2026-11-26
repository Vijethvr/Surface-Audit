// LOCAL DEVELOPMENT ONLY. Encrypted-vault custody without decrypting archives.
// A SHA-256 receipt detects accidental changes relative to this LOCAL receipt;
// it does not authenticate the original vault, prove independent custody, or
// replace encrypted offsite storage and a real restore drill.
import {createHash} from "node:crypto";
import {copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync,constants} from "node:fs";
import {basename,dirname,join,resolve,sep} from "node:path";

const [command,arg1,arg2,arg3]=process.argv.slice(2);
const usage="Usage: node scripts/vault-custody.mjs store <existing-encrypted-vault-dir> <existing-archive-root> <label> | verify <archive-root> <label> | inventory <archive-root> | plan <archive-root> <keep-latest-count>";
if(!["store","verify","inventory","plan"].includes(command))throw Error(usage);
if(process.env.NODE_ENV==="production")throw Error("Development-only archive custody: production use refused");
const magic=Buffer.from("SURFAUD1"),max=256*1024*1024+8192;
const labelPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
function checkDirectory(path,description){
 const absolute=resolve(path);
 if(!existsSync(absolute)||!lstatSync(absolute).isDirectory()||lstatSync(absolute).isSymbolicLink())
  throw Error(description+" must be an existing real directory");
 return absolute;
}
function noSymlinkParents(path){
 let p=resolve(path);
 while(true){
  if(existsSync(p)&&lstatSync(p).isSymbolicLink())throw Error("Symlink path refused: "+p);
  const parent=dirname(p);
  if(parent===p)break;
  p=parent;
 }
}
function readVault(path){
 noSymlinkParents(path);
 const st=lstatSync(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size<60||st.size>max)throw Error("Invalid vault file type or size");
 const data=readFileSync(path);
 if(!data.subarray(0,8).equals(magic))throw Error("Invalid encrypted backup magic");
 return {bytes:data.length,sha256:createHash("sha256").update(data).digest("hex")};
}
function validateLabel(label){
 if(!labelPattern.test(label??""))throw Error("Label must be 1-80 ASCII letters, digits, _ or - and start with an alphanumeric character");
 return label;
}
function receipt(root,label){
 validateLabel(label);
 const dir=join(root,label);
 noSymlinkParents(dir);
 if(!lstatSync(dir).isDirectory())throw Error("Archive entry is not a real directory");
 const manifest=join(dir,"custody.json"),vault=join(dir,"surface-audit.vault");
 if(!existsSync(manifest)||lstatSync(manifest).isSymbolicLink()||!lstatSync(manifest).isFile())throw Error("Missing custody receipt");
 if(statSync(manifest).size>4096)throw Error("Oversized receipt");
 const record=JSON.parse(readFileSync(manifest,"utf8"));
 if(record.version!==1||record.label!==label||!/^[a-f0-9]{64}$/.test(record.sha256)||
  !Number.isSafeInteger(record.bytes)||record.bytes<60||record.bytes>max||
  !Number.isFinite(Date.parse(record.archivedAt))||record.sourceName!=="surface-audit.vault")
  throw Error("Invalid custody receipt");
 const measured=readVault(vault);
 if(measured.sha256!==record.sha256||measured.bytes!==record.bytes)throw Error("Encrypted archive differs from custody receipt");
 return {label,archivedAt:record.archivedAt,bytes:record.bytes,sha256:record.sha256,status:"VERIFIED"};
}
function entries(root){
 return readdirSync(root,{withFileTypes:true})
  .filter(e=>e.isDirectory()&&!e.isSymbolicLink())
  .map(e=>{validateLabel(e.name);return receipt(root,e.name)})
  .sort((a,b)=>b.archivedAt.localeCompare(a.archivedAt)||b.label.localeCompare(a.label));
}
try{
 if(command==="store"){
  if(!arg1||!arg2||!arg3)throw Error(usage);
  const source=checkDirectory(arg1,"Encrypted source"),root=checkDirectory(arg2,"Archive root");
  noSymlinkParents(source);noSymlinkParents(root);
  const label=validateLabel(arg3);
  if(root===source||root.startsWith(source+sep)||source.startsWith(root+sep))
   throw Error("Source and archive root must be separate");
  const target=join(root,label);
  if(existsSync(target))throw Error("Archive label already exists; overwriting is forbidden");
  const input=join(source,"surface-audit.vault");
  const measured=readVault(input);
  let made=false;
  try{
   mkdirSync(target,{mode:0o700});made=true;
   copyFileSync(input,join(target,"surface-audit.vault"),constants.COPYFILE_EXCL);
   const copied=readVault(join(target,"surface-audit.vault"));
   if(copied.sha256!==measured.sha256||copied.bytes!==measured.bytes)throw Error("Copied vault failed SHA-256 comparison");
   const record={version:1,label,sourceName:"surface-audit.vault",archivedAt:new Date().toISOString(),...measured,
    warning:"LOCAL RECEIPT ONLY: verify encrypted envelope with passphrase and drill a separate database restore"};
   writeFileSync(join(target,"custody.json"),JSON.stringify(record,null,2)+"\n",{flag:"wx",mode:0o600});
   console.log("CUSTODY STORED:",JSON.stringify(receipt(root,label)));
  }catch(error){if(made)rmSync(target,{force:true,recursive:true});throw error}
 }else if(command==="verify"){
  if(!arg1||!arg2||arg3)throw Error(usage);
  const root=checkDirectory(arg1,"Archive root");noSymlinkParents(root);
  console.log("CUSTODY VERIFIED:",JSON.stringify(receipt(root,validateLabel(arg2))));
 }else if(command==="inventory"){
  if(!arg1||arg2||arg3)throw Error(usage);
  const root=checkDirectory(arg1,"Archive root");noSymlinkParents(root);
  console.log("CUSTODY INVENTORY:",JSON.stringify({count:entries(root).length,archives:entries(root)}));
 }else{
  if(!arg1||!arg2||arg3)throw Error(usage);
  const root=checkDirectory(arg1,"Archive root");noSymlinkParents(root);
  const keep=Number(arg2);
  if(!Number.isSafeInteger(keep)||keep<2||keep>1000)throw Error("Retention floor: keep at least 2 and at most 1000 archives");
  const all=entries(root);
  console.log("RETENTION DRY RUN:",JSON.stringify({keep,retained:all.slice(0,keep).map(a=>a.label),
   candidatesForManualReview:all.slice(keep).map(a=>a.label),deleted:0,
   warning:"No files are deleted. Review recovery obligations and independent copies before any manual retention decision."}));
 }
}catch(error){
 console.error("CUSTODY FAILED:",error instanceof Error?error.message:String(error));
 process.exitCode=1;
}
