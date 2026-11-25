import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {getSession} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
import {securityEventTypes} from "@/lib/security-events";

export const runtime="nodejs";
export const dynamic="force-dynamic";

// Bounded operator-only register; deliberately excludes passwords, tokens,
// raw IP addresses, credentials, request bodies and evidence contents.
export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const session=await getSession(request);
 if(session?.role!=="ADMIN")return NextResponse.json({error:"Administrator access required"},{status:403});
 const url=new URL(request.url);
 const kind=url.searchParams.get("type");
 if(kind!==null&&!securityEventTypes.includes(kind as typeof securityEventTypes[number]))
  return NextResponse.json({error:"Unknown security event type"},{status:400});
 const takeRaw=Number(url.searchParams.get("limit")??"50");
 if(!Number.isSafeInteger(takeRaw)||takeRaw<1||takeRaw>100)
  return NextResponse.json({error:"Limit must be 1 to 100"},{status:400});
 const events=await prisma.securityEvent.findMany({
  where:kind?{eventType:kind}:undefined,
  select:{id:true,eventType:true,outcome:true,actorUsername:true,subjectUsername:true,createdAt:true},
  orderBy:[{createdAt:"desc"},{id:"desc"}],take:takeRaw
 });
 return NextResponse.json({events,limit:takeRaw},{headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
