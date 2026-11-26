import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {authConfigured,cookieName,createSession,sessionMaxAge,validMutationOrigin,validLocalRequestHost,verifyPassword} from "@/lib/local-auth";
export const runtime="nodejs";

// This local PostgreSQL flow serializes attempts against one operator row.
// The row lock protects the counter, expiry, operator state and session creation
// from concurrent login attempts and concurrent administrator account changes.
// It is not distributed rate limiting, MFA, or a production identity service.
const lockoutWindowMs=15*60*1000;
const lockoutThreshold=5;
const dummyHash="00000000000000000000000000000000:"+("0".repeat(128));
const invalid=()=>NextResponse.json({error:"Invalid username or password"},{status:401,headers:{"Cache-Control":"no-store"}});

export async function POST(request:Request){
 if(!authConfigured())return NextResponse.json({error:"Local authentication is disabled"},{status:503});
 if(!validLocalRequestHost(request))return NextResponse.json({error:"Non-local request host rejected"},{status:403});
 if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let credentials:unknown;
 try{credentials=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 const data=credentials as {username?:unknown;password?:unknown}|null;
 if(!data||typeof data.username!=="string"||typeof data.password!=="string"||
  data.username.length>120||data.password.length>1024)return invalid();
 const username=data.username;
 const password=data.password;

 const result=await prisma.$transaction(async tx=>{
  // A locked row ensures no two attempts can load the same old failure count.
  // Parameterization prevents username SQL injection.
  const matching=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Operator" WHERE "username"=${username} FOR UPDATE`;
  if(matching.length===0){
   verifyPassword(password,dummyHash);
   return null;
  }
  const account=await tx.operator.findUnique({where:{id:matching[0].id}});
  if(!account){
   verifyPassword(password,dummyHash);
   return null;
  }
  const now=new Date();
  const locked=Boolean(account.loginLockedUntil&&account.loginLockedUntil>now);
  // Equalize the hashing work of unknown, disabled and locked accounts.
  const verified=verifyPassword(password,account.active&&!locked?account.passwordHash:dummyHash);
  if(!account.active||locked||!verified){
   if(account.active&&!locked){
    const recent=Boolean(account.lastFailedLoginAt&&now.getTime()-account.lastFailedLoginAt.getTime()<lockoutWindowMs);
    const count=recent?account.failedLoginCount+1:1;
    await tx.operator.update({where:{id:account.id},data:{
     failedLoginCount:count,
     lastFailedLoginAt:now,
     loginLockedUntil:count>=lockoutThreshold?new Date(now.getTime()+lockoutWindowMs):null
    }});
    await tx.securityEvent.create({data:{eventType:count>=lockoutThreshold?"LOGIN_LOCKED":"LOGIN_FAILED",outcome:"DENIED",subjectUsername:account.username}});
   }else if(account.active&&locked){
    await tx.securityEvent.create({data:{eventType:"LOGIN_LOCKED",outcome:"DENIED",subjectUsername:account.username}});
   }
   return null;
  }
  await tx.operator.update({where:{id:account.id},data:{failedLoginCount:0,lastFailedLoginAt:null,loginLockedUntil:null}});
  await tx.securityEvent.create({data:{eventType:"LOGIN_SUCCEEDED",outcome:"SUCCESS",actorUsername:account.username}});
  const token=await createSession(account.id,tx);
  return {token,username:account.username,role:account.role};
 },{maxWait:20000,timeout:30000});
 if(!result)return invalid();
 const response=NextResponse.json({ok:true,username:result.username,role:result.role},{headers:{"Cache-Control":"no-store"}});
 response.cookies.set(cookieName,result.token,{httpOnly:true,sameSite:"strict",secure:false,path:"/",maxAge:sessionMaxAge});
 return response;
}
