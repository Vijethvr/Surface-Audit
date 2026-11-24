import { NextResponse } from "next/server";
import { authConfigured,getSession } from "@/lib/local-auth";
export const dynamic="force-dynamic";
export function GET(request:Request){
  if(!authConfigured())return NextResponse.json({authenticated:false,configured:false},{headers:{"Cache-Control":"no-store"}});
  const session=getSession(request);
  return NextResponse.json({authenticated:!!session,configured:true,username:session?.username??null},{headers:{"Cache-Control":"no-store"}});
}
