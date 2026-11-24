import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const cookieName = "surface_audit_session";
const lifespanSeconds = 8 * 60 * 60;

export function authConfigured() {
  return process.env.NODE_ENV === "development"
    && process.env.SURFACE_AUDIT_ENABLE_LOCAL_API === "true"
    && Boolean(process.env.DATABASE_URL)
    && Boolean(process.env.SURFACE_AUDIT_ADMIN_USERNAME)
    && Boolean(process.env.SURFACE_AUDIT_ADMIN_PASSWORD_SCRYPT)
    && (process.env.SURFACE_AUDIT_SESSION_SECRET?.length ?? 0) >= 32;
}

function constantEqual(a:string,b:string) {
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
export function verifyCredentials(username:string,password:string) {
  if(!authConfigured() || password.length>1024 || username.length>120) return false;
  const stored=process.env.SURFACE_AUDIT_ADMIN_PASSWORD_SCRYPT!.split(":");
  if(stored.length!==2 || !/^[a-f0-9]{32,}$/i.test(stored[0]) || !/^[a-f0-9]{128}$/i.test(stored[1]))return false;
  const hash=scryptSync(password,Buffer.from(stored[0],"hex"),64).toString("hex");
  return constantEqual(username,process.env.SURFACE_AUDIT_ADMIN_USERNAME!) && constantEqual(hash,stored[1]);
}
const signature=(body:string)=>createHmac("sha256",process.env.SURFACE_AUDIT_SESSION_SECRET!).update(body).digest("base64url");
export function createSession() {
  const body=Buffer.from(JSON.stringify({sub:process.env.SURFACE_AUDIT_ADMIN_USERNAME,exp:Math.floor(Date.now()/1000)+lifespanSeconds})).toString("base64url");
  return body+"."+signature(body);
}
export function getSession(request:Request):{username:string}|null{
  if(!authConfigured())return null;
  const cookie=request.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="));
  if(!cookie)return null;
  const raw=cookie.slice(cookieName.length+1);
  const [body,mac,...extra]=raw.split(".");
  if(!body||!mac||extra.length||body.length>512)return null;
  if(!constantEqual(signature(body),mac))return null;
  try{
    const obj=JSON.parse(Buffer.from(body,"base64url").toString()) as {sub?:string;exp?:number};
    if(obj.sub!==process.env.SURFACE_AUDIT_ADMIN_USERNAME || typeof obj.exp!=="number" || obj.exp<=Math.floor(Date.now()/1000))return null;
    return {username:obj.sub};
  }catch{return null}
}
export function validMutationOrigin(request:Request){
  const origin=request.headers.get("origin");
  // Browser state-changing requests must have a same-origin Origin header.
  if(!origin)return false;
  try{return new URL(origin).origin===new URL(request.url).origin}catch{return false}
}
export const sessionMaxAge=lifespanSeconds;
