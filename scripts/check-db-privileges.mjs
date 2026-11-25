// Read-only local PostgreSQL runtime account privilege preflight.
// This is a warning/blocker for development setups, not an authorization
// against database owners or a proof of production safety.
import {PrismaClient} from "@prisma/client";
import {existsSync} from "node:fs";
import {loadEnvFile} from "node:process";
if(existsSync(".env.local")&&!process.env.CI)loadEnvFile(".env.local");
const source=process.env.DATABASE_URL;
if(!source)throw Error("DATABASE_URL required");
const parsed=new URL(source);
if(!["postgres:","postgresql:"].includes(parsed.protocol)||
 !["localhost","127.0.0.1","::1","[::1]"].includes(parsed.hostname))
 throw Error("Refusing non-loopback database inspection");
const db=new PrismaClient();
try{
 const rows=await db.$queryRaw`
  SELECT current_user AS username,
   (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
   (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS cancreatedb,
   (SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user) AS cancreaterole,
   has_schema_privilege(current_user,'public','CREATE') AS cancreateschema,
   has_database_privilege(current_user,current_database(),'CREATE') AS cancreatedatabase,
   (SELECT pg_get_userbyid(datdba)=current_user FROM pg_database WHERE datname=current_database()) AS ownsdatabase
 `;
 const r=rows[0];
 if(!r)throw Error("No role information returned");
 const dangerous=r.superuser||r.cancreatedb||r.cancreaterole||r.cancreateschema||r.cancreatedatabase||r.ownsdatabase;
 console.log("RUNTIME DATABASE ROLE:",JSON.stringify({name:r.username,restricted:!dangerous,
  restrictions:{superuser:!r.superuser,roleAdmin:!r.cancreaterole,dbCreate:!r.cancreatedb,
  schemaCreate:!r.cancreateschema,databaseCreate:!r.cancreatedatabase,notDatabaseOwner:!r.ownsdatabase}}));
 if(dangerous){console.error("BLOCKED: runtime database credentials carry ownership/DDL privileges. Use separate migration and application users.");process.exitCode=2}
 else console.log("PASS: runtime PostgreSQL credentials have no database owner, schema DDL or role-admin privileges. Table grants still require separate review.");
}catch(error){console.error("Database role check failed:",error instanceof Error?error.message:String(error));process.exitCode=1}
finally{await db.$disconnect()}
