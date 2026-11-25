import {NextResponse} from "next/server";
import {authConfigured,canEdit,getSession,validMutationOrigin,validLocalRequestHost} from "@/lib/local-auth";

export async function requireLocalPrototype(request:Request){
 if(!authConfigured())return NextResponse.json({error:"Database API is disabled or not configured for local development"},{status:403});
 if(!validLocalRequestHost(request))return NextResponse.json({error:"Non-local request host rejected"},{status:403});
 const user=await getSession(request);
 if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 if(!["GET","HEAD","OPTIONS"].includes(request.method)){
  if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid request origin"},{status:403});
  if(!canEdit(user.role))return NextResponse.json({error:"Insufficient permissions for this operation"},{status:403});
 }
 return null;
}
