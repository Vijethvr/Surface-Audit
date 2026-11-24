import { randomBytes,scryptSync } from "node:crypto";
import { createInterface } from "node:readline";
const rl=createInterface({input:process.stdin,output:process.stdout});
rl.question("Choose a local password (min 16 characters): ",password=>{
  rl.close();
  if(password.length<16){console.error("Password must be at least 16 characters.");process.exitCode=1;return;}
  const salt=randomBytes(16).toString("hex");
  console.log("\nAdd this value to .env.local as SURFACE_AUDIT_ADMIN_PASSWORD_SCRYPT:");
  console.log(salt+":"+scryptSync(password,Buffer.from(salt,"hex"),64).toString("hex"));
  console.log("\nGenerate a session secret with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
});
