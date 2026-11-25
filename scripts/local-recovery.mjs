// LOCAL DEVELOPMENT ONLY. Backup -> verify -> restore into a DIFFERENT EMPTY
// PostgreSQL database. Never overwrites existing database tables.
import {existsSync,mkdirSync,readFileSync,renameSync,rmSync,statSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {loadEnvFile} from "node:process";

const usage="Usage: node scripts/local-recovery.mjs backup|verify <directory> OR restore <directory> <new-empty-database-name> --confirm=<new-empty-database-name>";
const [operation,directory,targetName,confirmation]=process.argv.slice(2);
if(!["backup","verify","restore"].includes(operation)||!directory)throw Error(usage);
if(process.env.NODE_ENV==="production")throw Error("Refusing production use. This is a local-development recovery tool.");
if(existsSync(".env.local"))loadEnvFile(".env.local");

function config(){
 const source=process.env.DATABASE_URL;
 if(!source)throw Error("DATABASE_URL missing; refusing backup or restore.");
 const url=new URL(source);
 if(!["postgres:","postgresql:"].includes(url.protocol))throw Error("PostgreSQL required");
 if(!["localhost","127.0.0.1","[::1]","::1"].includes(url.hostname))throw Error("Refusing non-loopback database host");
 if(url.searchParams.get("schema")&&!["public"].includes(url.searchParams.get("schema")))throw Error("Only public schema supported");
 const database=decodeURIComponent(url.pathname.slice(1));
 if(!/^[a-zA-Z0-9_]{1,63}$/.test(database))throw Error("Database name must contain only letters, digits, underscores");
 return {host:url.hostname,port:url.port||"5432",user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database};
}
function run(command,args,cfg){
 const env={...process.env,PGPASSWORD:cfg.password,PGCONNECT_TIMEOUT:"8",PGOPTIONS:"-c statement_timeout=120000"};
 const result=spawnSync(command,args,{env,encoding:"utf8",timeout:180000,maxBuffer:5_000_000});
 if(result.error)throw Error(command+" could not run: "+result.error.message+" (install PostgreSQL client tools and put them on PATH)");
 if(result.status!==0)throw Error(command+" failed (exit "+result.status+"): "+(result.stderr||result.stdout||"").slice(0,1200));
 return (result.stdout||"").trim();
}
function connect(cfg,database){return ["-h",cfg.host,"-p",cfg.port,"-U",cfg.user,"-d",database]}
const dir=resolve(directory);
const archive=join(dir,"surface-audit.backup");
const manifestPath=join(dir,"manifest.json");
function digest(path){return createHash("sha256").update(readFileSync(path)).digest("hex")}
function verifyArchive(){
 if(!existsSync(archive)||!existsSync(manifestPath))throw Error("Archive or manifest not found");
 const m=JSON.parse(readFileSync(manifestPath,"utf8"));
 if(m.format!=="surface-audit-pg-custom-v1"||!m.sha256||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error("Invalid recovery manifest");
 if(statSync(archive).size!==m.bytes||digest(archive)!==m.sha256)throw Error("Backup archive checksum mismatch");
 const listed=run("pg_restore",["--list",archive],{password:""});
 if(!listed.includes("TABLE DATA")||!listed.includes("Audit"))throw Error("Archive does not contain expected SURFACE Audit table data");
 return m;
}
try{
 if(operation==="backup"){
  const cfg=config();
  if(existsSync(archive)||existsSync(manifestPath))throw Error("Destination backup already exists. Use a new directory to prevent overwrites.");
  mkdirSync(dir,{recursive:true,mode:0o700});
  const temp=archive+".partial";
  try{
   run("pg_dump",[...connect(cfg,cfg.database),"--format=custom","--no-owner","--no-acl","--file",temp],cfg);
   // Verify that PostgreSQL can parse the archive before making it available.
   const listed=run("pg_restore",["--list",temp],cfg);
   if(!listed.includes("TABLE DATA"))throw Error("Backup has no database table records");
   renameSync(temp,archive);
   const manifest={format:"surface-audit-pg-custom-v1",createdAt:new Date().toISOString(),database:cfg.database,
     bytes:statSync(archive).size,sha256:digest(archive),warning:"LOCAL DEVELOPMENT COPY — NOT AN INDEPENDENT SIGNATURE OR ENCRYPTED BACKUP"};
   writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+"\n",{flag:"wx",mode:0o600});
   console.log("BACKUP OK:",JSON.stringify({directory:dir,bytes:manifest.bytes,sha256:manifest.sha256}));
  }finally{if(existsSync(temp))rmSync(temp)}
 }else if(operation==="verify"){
  const m=verifyArchive();console.log("VERIFY OK:",JSON.stringify({directory:dir,bytes:m.bytes,sha256:m.sha256}));
 }else{
  const cfg=config();
  if(!targetName||!confirmation||confirmation!=="--confirm="+targetName||!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(targetName))
   throw Error("Specify a NEW database name and explicit matching --confirm=name; "+usage);
  if(targetName===cfg.database)throw Error("Restore target must differ from source DATABASE_URL database");
  const m=verifyArchive();
  const count=run("psql",[...connect(cfg,targetName),"-X","-A","-t","-v","ON_ERROR_STOP=1","-c",
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"],cfg);
  if(count!=="0")throw Error("Refusing restore: destination already contains tables. Create a NEW EMPTY database.");
  run("pg_restore",[...connect(cfg,targetName),"--single-transaction","--exit-on-error","--no-owner","--no-acl",archive],cfg);
  const row=run("psql",[...connect(cfg,targetName),"-X","-A","-t","-v","ON_ERROR_STOP=1","-c",
    'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'],cfg);
  if(!/^\d+$/.test(row)||Number(row)<2)throw Error("Restore completed but versioned migration ledger is missing; inspect restored database");
  console.log("RESTORE OK:",JSON.stringify({destinationDatabase:targetName,migrations:Number(row),archiveSha256:m.sha256}));
 }
}catch(error){
 console.error("RECOVERY FAILED:",error instanceof Error?error.message:String(error));
 process.exitCode=1;
}
