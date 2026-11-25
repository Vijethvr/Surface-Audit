// Local deployment safety audit. No migrations or changes are made.
// Run before starting SURFACE Audit with a real local development database.
import {existsSync} from "node:fs";
import {loadEnvFile} from "node:process";
if(existsSync(".env.local"))loadEnvFile(".env.local");
const checks=[];
const check=(name,ok,explanation)=>checks.push({name,result:ok?"PASS":"FAIL",explanation});
const enabled=process.env.SURFACE_AUDIT_ENABLE_LOCAL_API==="true";
const storage=process.env.NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE||"browser";
check("Node.js major version",process.versions.node.split(".")[0]==="22","Validated development runtime: Node.js 22");
check("No production mode",process.env.NODE_ENV!=="production","Database-enabled app must not run in production");
check("Database API flag",enabled,"Set SURFACE_AUDIT_ENABLE_LOCAL_API=true for PostgreSQL mode");
check("PostgreSQL storage mode",storage==="postgres","Set NEXT_PUBLIC_SURFACE_AUDIT_STORAGE_MODE=postgres");
let databaseHost="";
try{
 const url=new URL(process.env.DATABASE_URL||"");
 databaseHost=url.hostname;
 check("Local PostgreSQL endpoint",["postgresql:","postgres:"].includes(url.protocol)&&["localhost","127.0.0.1","[::1]","::1"].includes(url.hostname),"Remote databases are not supported");
 check("Explicit PostgreSQL credentials",Boolean(url.username&&url.password&&url.pathname.length>1),"Use a distinct local database user and name");
}catch{check("Local PostgreSQL endpoint",false,"DATABASE_URL must be a loopback PostgreSQL URL");check("Explicit PostgreSQL credentials",false,"DATABASE_URL invalid")}
const desiredHost=process.env.SURFACE_AUDIT_BIND_HOST||"127.0.0.1";
check("Browser server bind host",["127.0.0.1","localhost","::1"].includes(desiredHost),"Use npm run dev -- -H 127.0.0.1 -p 3001; do not listen on 0.0.0.0");
check("No sensitive data assurance",true,"Local development only; this check cannot certify data confidentiality or network isolation");
console.log("SURFACE Audit local deployment preflight");
for(const c of checks)console.log(c.result.padEnd(4),c.name+" — "+c.explanation);
const problems=checks.filter(c=>c.result==="FAIL");
if(problems.length){console.error("PREFLIGHT FAILED:",problems.length,"blocking configuration checks. No database changes made.");process.exitCode=1}
else console.log("PREFLIGHT PASSED: configuration checks only, not a security certification. Database connectivity and migration history still need separate checks.");
