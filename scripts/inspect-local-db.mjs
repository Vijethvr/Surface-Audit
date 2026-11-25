import {PrismaClient} from "@prisma/client";
import {existsSync} from "node:fs";
import {loadEnvFile} from "node:process";

if(existsSync(".env.local"))loadEnvFile(".env.local");
if(process.env.NODE_ENV==="production")throw Error("This tool only supports disposable development databases.");
const url=process.env.DATABASE_URL;
if(!url)throw Error("DATABASE_URL missing. Refusing to inspect any database.");
const parsed=new URL(url);
if(!["127.0.0.1","localhost","::1","[::1]"].includes(parsed.hostname))
 throw Error("Database host is not loopback. This tool refuses remote databases.");
if(!["postgresql:","postgres:"].includes(parsed.protocol))throw Error("Only PostgreSQL is supported.");
const client=new PrismaClient();
try{
 const tables=await client.$queryRaw`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
 const names=new Set(tables.map(row=>row.name));
 const columns=await client.$queryRaw`SELECT column_name AS name FROM information_schema.columns WHERE table_schema='public' AND table_name='Audit'`;
 const cols=new Set(columns.map(row=>row.name));
 const migrationRows=names.has("_prisma_migrations")?
  await client.$queryRaw`SELECT migration_name AS name,finished_at AS finished,rolled_back_at AS rolled_back FROM "_prisma_migrations" ORDER BY started_at`:[];
 const hasAppTables=names.has("Audit")||names.has("Client")||names.has("Operator");
 const latest="20261125190000_audit_revision";
 const fullyApplied=migrationRows.some(row=>row.name===latest&&row.finished!==null&&row.rolled_back===null);
 const failed=migrationRows.filter(row=>!row.finished&&!row.rolled_back).map(row=>row.name);
 const category=failed.length?"migration_attention_required":
   !hasAppTables?"empty_database":
   !names.has("_prisma_migrations")?"legacy_without_migration_ledger":
   fullyApplied&&cols.has("revision")?"current_versioned_database":"versioned_upgrade_pending";
 const report={
  category,
  developmentOnly:true,
  server:parsed.hostname,
  database:parsed.pathname.slice(1),
  tables:tables.length,
  auditRevisionColumn:cols.has("revision"),
  appliedMigrations:migrationRows.filter(row=>row.finished&&!row.rolled_back).map(row=>row.name),
  failedMigrations:failed,
  nextStep:category==="empty_database"?"Run npx prisma migrate deploy on this empty disposable database":
   category==="current_versioned_database"?"No schema action required; continue using the disposable local database":
   category==="versioned_upgrade_pending"?"Back up first, review pending migration SQL, then run npx prisma migrate deploy":
   "Stop. Back up this database. Do not apply the initial baseline blindly; arrange reviewed schema baselining or migration recovery"
 };
 console.log(JSON.stringify(report,null,2));
 if(category==="migration_attention_required"||category==="legacy_without_migration_ledger")process.exitCode=2;
}catch(error){
 console.error("Database inspection failed:",error instanceof Error?error.message:String(error));
 process.exitCode=1;
}finally{await client.$disconnect()}
