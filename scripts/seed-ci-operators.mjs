import {PrismaClient} from "@prisma/client";
import {randomBytes,scryptSync} from "node:crypto";
if(process.env.CI!=="true")throw Error("CI-only test seed refused");
const prisma=new PrismaClient();
const password="CI-password-only-not-for-real-users";
function hashed(){const salt=randomBytes(16).toString("hex");return salt+":"+scryptSync(password,Buffer.from(salt,"hex"),64).toString("hex")}
try{
 for(const [username,role] of [["local-admin","ADMIN"],["ci-editor","EDITOR"],["ci-reviewer","REVIEWER"],["ci-viewer","VIEWER"]]){
  await prisma.operator.upsert({where:{username},update:{passwordHash:hashed(),role,active:true},create:{username,passwordHash:hashed(),role,active:true}});
 }
 console.log("CI operators seeded in isolated disposable PostgreSQL database");
}finally{await prisma.$disconnect()}
