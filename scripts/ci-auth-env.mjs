import {randomBytes,scryptSync} from "node:crypto";
import {appendFileSync} from "node:fs";
if(process.env.CI!=="true"||!process.env.GITHUB_ENV)throw Error("CI only");
const salt=randomBytes(16).toString("hex");
const hash=scryptSync("CI-password-only-not-for-real-users",Buffer.from(salt,"hex"),64).toString("hex");
appendFileSync(process.env.GITHUB_ENV,"SURFACE_AUDIT_ADMIN_PASSWORD_SCRYPT="+salt+":"+hash+"\n");
appendFileSync(process.env.GITHUB_ENV,"SURFACE_AUDIT_SESSION_SECRET="+randomBytes(32).toString("hex")+"\n");
