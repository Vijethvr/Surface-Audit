import { NextResponse } from "next/server";
import { cookieName,validMutationOrigin } from "@/lib/local-auth";
export async function POST(request:Request){
  if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(cookieName,"",{path:"/",maxAge:0,httpOnly:true,sameSite:"strict"});
  return response;
}
