import {createHash,randomBytes,scryptSync,timingSafeEqual} from "node:crypto";
import {prisma} from "@/lib/db";
import type {OperatorRole} from "@prisma/client";
export const cookieName="surface_audit_session";
export const sessionMaxAge=8*60*60;
export type OperatorIdentity={id:string;username:string;role:OperatorRole};
export function authConfigured(){
 return process.env.NODE_ENV==="development"
  && process.env.SURFACE_AUDIT_ENABLE_LOCAL_API==="true"
  && Boolean(process.env.DATABASE_URL);
}
export function passwordHash(password:string){
 if(password.length<16||password.length>1024)throw Error("Password must be 16–1024 characters");
 const salt=randomBytes(16).toString("hex");
 return salt+":"+scryptSync(password,Buffer.from(salt,"hex"),64).toString("hex");
}
export function verifyPassword(password:string,stored:string){
 if(password.length>1024)return false;
 const parts=stored.split(":");
 if(parts.length!==2||!/^[a-f0-9]{32}$/i.test(parts[0])||!/^[a-f0-9]{128}$/i.test(parts[1]))return false;
 const hash=scryptSync(password,Buffer.from(parts[0],"hex"),64);
 const expected=Buffer.from(parts[1],"hex");
 return timingSafeEqual(hash,expected);
}
const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");
function extractToken(request:Request){
 const field=request.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(cookieName+"="));
 const token=field?.slice(cookieName.length+1);
 return token&&/^[a-f0-9]{64}$/.test(token)?token:null;
}
export async function getSession(request:Request):Promise<OperatorIdentity|null>{
 if(!authConfigured()||!validLocalRequestHost(request))return null;
 const token=extractToken(request);if(!token)return null;
 const row=await prisma.operatorSession.findUnique({where:{tokenHash:hashToken(token)},include:{operator:true}});
 if(!row||row.expiresAt<=new Date()||!row.operator.active)return null;
 return {id:row.operator.id,username:row.operator.username,role:row.operator.role};
}
export async function createSession(operatorId:string){
 const token=randomBytes(32).toString("hex");
 await prisma.operatorSession.create({data:{tokenHash:hashToken(token),operatorId,expiresAt:new Date(Date.now()+sessionMaxAge*1000)}});
 return token;
}
export async function destroySession(request:Request){
 const token=extractToken(request);
 if(token)await prisma.operatorSession.deleteMany({where:{tokenHash:hashToken(token)}});
}
export function validLocalRequestHost(request:Request){
 try{
  const supplied=request.headers.get("host");
  if(!supplied||supplied.includes("/")||supplied.includes("@"))return false;
  const parsed=new URL("http://"+supplied);
  const requestUrl=new URL(request.url);
  if(!["localhost","127.0.0.1","[::1]"].includes(parsed.hostname))return false;
  if(!["localhost","127.0.0.1","[::1]"].includes(requestUrl.hostname))return false;
  return parsed.host===requestUrl.host&&parsed.username===""&&parsed.password==="";
 }catch{return false}
}
export function validMutationOrigin(request:Request){
 if(!validLocalRequestHost(request))return false;
 const origin=request.headers.get("origin");
 const host=request.headers.get("host");
 if(!origin||!host)return false;
 try{const parsed=new URL(origin);return parsed.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(parsed.hostname)&&parsed.host===host}
 catch{return false}
}
export function canEdit(role:OperatorRole){return role==="ADMIN"||role==="EDITOR"}
export function canReview(role:OperatorRole){return role==="ADMIN"||role==="REVIEWER"}
