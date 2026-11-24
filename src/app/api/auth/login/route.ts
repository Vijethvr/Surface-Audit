import { NextResponse } from "next/server";
import { authConfigured,cookieName,createSession,sessionMaxAge,validMutationOrigin,verifyCredentials } from "@/lib/local-auth";
export const runtime="nodejs";
export async function POST(request:Request){
  if(!authConfigured())return NextResponse.json({error:"Local authentication is not configured."},{status:503});
  if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  let credentials:unknown;
  try{credentials=await request.json()}catch{return NextResponse.json({error:"Invalid request"},{status:400})}
  if(!credentials||typeof credentials!=="object")return NextResponse.json({error:"Invalid credentials"},{status:401});
  const data=credentials as Record<string,unknown>;
  if(typeof data.username!=="string"||typeof data.password!=="string"||!verifyCredentials(data.username,data.password)){
    return NextResponse.json({error:"Invalid username or password"},{status:401,headers:{"Cache-Control":"no-store"}});
  }
  const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(cookieName,createSession(),{httpOnly:true,sameSite:"strict",secure:false,path:"/",maxAge:sessionMaxAge});
  return response;
}
