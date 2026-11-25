// Creates ONLY a disposable restricted PostgreSQL role in GitHub CI.
// Do not run against real/local databases or production.
import {PrismaClient} from "@prisma/client";
if(process.env.CI!=="true"||process.env.NODE_ENV==="production"||
  !process.env.DATABASE_URL?.includes("surface_audit_ci"))
 throw Error("Refusing runtime role provisioning outside isolated CI");
const prisma=new PrismaClient();
try{
 // Static, disposable credentials. No privileges to create/alter tables or roles.
 await prisma.$executeRawUnsafe("CREATE ROLE surfaceaudit_app_ci LOGIN PASSWORD 'ci_only_app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION");
 await prisma.$executeRawUnsafe("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
 await prisma.$executeRawUnsafe("GRANT CONNECT ON DATABASE surface_audit_ci TO surfaceaudit_app_ci");
 await prisma.$executeRawUnsafe("GRANT USAGE ON SCHEMA public TO surfaceaudit_app_ci");
 await prisma.$executeRawUnsafe("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO surfaceaudit_app_ci");
 const result=await prisma.$queryRaw`SELECT rolcreatedb, rolcreaterole, rolsuper FROM pg_roles WHERE rolname='surfaceaudit_app_ci'`;
 if(result.length!==1||result[0].rolcreatedb||result[0].rolcreaterole||result[0].rolsuper)
  throw Error("Runtime role privilege assertion failed");
 console.log("PASS: restricted disposable runtime role created without database owner or DDL privileges");
}finally{await prisma.$disconnect()}
