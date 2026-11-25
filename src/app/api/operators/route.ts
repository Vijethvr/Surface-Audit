import {NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {getSession,validMutationOrigin} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
export const runtime="nodejs";export const dynamic="force-dynamic";
const change=z.object({id:z.string().cuid(),active:z.boolean().optional(),resetLockout:z.boolean().optional()}).refine(v=>v.active!==undefined||v.resetLockout===true);
export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const user=await getSession(request);if(user?.role!=="ADMIN")return NextResponse.json({error:"Administrator only"},{status:403});
 const operators=await prisma.operator.findMany({select:{id:true,username:true,role:true,active:true,createdAt:true,failedLoginCount:true,loginLockedUntil:true},orderBy:{username:"asc"}});
 return NextResponse.json({operators},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(request:Request){
 const user=await getSession(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 if(user.role!=="ADMIN")return NextResponse.json({error:"Administrator only"},{status:403});
 if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 const parsed=change.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid operator change"},{status:400});
 if(parsed.data.id===user.id&&parsed.data.active===false)return NextResponse.json({error:"Cannot deactivate own current account"},{status:409});
 const operator=await prisma.operator.findUnique({where:{id:parsed.data.id}});
 if(!operator)return NextResponse.json({error:"Operator not found"},{status:404});
 await prisma.$transaction(async tx=>{
  await tx.operator.update({where:{id:operator.id},data:{
   ...(parsed.data.active!==undefined?{active:parsed.data.active}:{}),
   ...(parsed.data.resetLockout===true?{failedLoginCount:0,lastFailedLoginAt:null,loginLockedUntil:null}:{})
  }});
  if(parsed.data.active===false)await tx.operatorSession.deleteMany({where:{operatorId:operator.id}});
 });
 return NextResponse.json({ok:true});
}
