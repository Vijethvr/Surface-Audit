import {getSession} from "@/lib/local-auth";
import {recordSecurityEvent} from "@/lib/security-events";
import {NextResponse} from "next/server";
import {cookieName,destroySession,validMutationOrigin} from "@/lib/local-auth";
export async function POST(request:Request){
 if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 const user=await getSession(request);
 await destroySession(request);
 if(user)await recordSecurityEvent({eventType:"LOGOUT",outcome:"SUCCESS",actorUsername:user.username});
 const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 response.cookies.set(cookieName,"",{path:"/",maxAge:0,httpOnly:true,sameSite:"strict"});
 return response;
}
