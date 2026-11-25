import {PrismaClient} from "@prisma/client";
import {randomBytes,scryptSync} from "node:crypto";
import {createInterface} from "node:readline";
import {existsSync} from "node:fs";
import {loadEnvFile} from "node:process";
// Node 22: match Next.js local environment behavior for this CLI.
if(existsSync(".env.local"))loadEnvFile(".env.local");
if(process.env.NODE_ENV==="production"||process.env.SURFACE_AUDIT_ENABLE_LOCAL_API!=="true")throw Error("Only explicit local development operator setup is supported");
const [username,role]=process.argv.slice(2);
if(!username||!/^[a-zA-Z0-9_.-]{3,60}$/.test(username)||!["ADMIN","EDITOR","REVIEWER","VIEWER"].includes(role||"")){
 console.error("Usage: node scripts/create-local-operator.mjs username ADMIN|EDITOR|REVIEWER|VIEWER");process.exit(2);
}
const rl=createInterface({input:process.stdin,output:process.stdout});
rl.question("Temporary local password (at least 16 characters): ",async password=>{
 rl.close();
 if(password.length<16||password.length>1024){console.error("Invalid password length");process.exitCode=1;return}
 const db=new PrismaClient();const salt=randomBytes(16).toString("hex");
 try{await db.operator.create({data:{username,role,passwordHash:salt+":"+scryptSync(password,Buffer.from(salt,"hex"),64).toString("hex")}});
 console.log("Local operator created. Password will not be displayed again.");
 }catch(e){console.error("Operator creation failed",e);process.exitCode=1}finally{await db.$disconnect()}
});
