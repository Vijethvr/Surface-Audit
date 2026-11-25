import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {authConfigured,cookieName,createSession,sessionMaxAge,validMutationOrigin,verifyPassword} from "@/lib/local-auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!authConfigured())return NextResponse.json({error:"Local authentication is disabled"},{status:503});
 if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let credentials:unknown;
 try{credentials=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
 const data=credentials as {username?:unknown;password?:unknown}|null;
 if(!data||typeof data.username!=="string"||typeof data.password!=="string"||
  data.username.length>120||data.password.length>1024)return NextResponse.json({error:"Invalid credentials"},{status:401});
 const account=await prisma.operator.findUnique({where:{username:data.username}});
 // Compute password hash even for unknown users to reduce simple timing differences.
 const dummy="00000000000000000000000000000000:"+("0".repeat(128));
 const verified=verifyPassword(data.password,account?.passwordHash??dummy);
 if(!account||!account.active||!verified)return NextResponse.json({error:"Invalid username or password"},{status:401,headers:{"Cache-Control":"no-store"}});
 const token=await createSession(account.id);
 const response=NextResponse.json({ok:true,username:account.username,role:account.role},{headers:{"Cache-Control":"no-store"}});
 response.cookies.set(cookieName,token,{httpOnly:true,sameSite:"strict",secure:false,path:"/",maxAge:sessionMaxAge});
 return response;
}
