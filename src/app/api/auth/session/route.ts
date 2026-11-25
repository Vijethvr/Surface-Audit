import {NextResponse} from "next/server";
import {authConfigured,getSession} from "@/lib/local-auth";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!authConfigured())return NextResponse.json({authenticated:false,configured:false},{headers:{"Cache-Control":"no-store"}});
 const user=await getSession(request);
 return NextResponse.json({authenticated:!!user,configured:true,username:user?.username??null,role:user?.role??null},{headers:{"Cache-Control":"no-store"}});
}
