import {NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/db";
import {requireLocalPrototype} from "@/lib/dev-api";
import {getSession} from "@/lib/local-auth";
import {blueprint,builtins,methodologyCreate} from "@/lib/methodologies";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const [rows,count]=await Promise.all([
  prisma.consultingMethodology.findMany({orderBy:[{createdAt:"desc"},{id:"asc"}],take:100}),
  prisma.consultingMethodology.count()
 ]);
 return NextResponse.json({methodologies:[...builtins,...rows.flatMap(row=>{
  const valid=blueprint.safeParse(row.blueprint);
  return valid.success?[{id:row.id,title:row.title,description:row.description,revision:row.revision,
   blueprint:valid.data,builtin:false}]:[];
 })],totalCustom:count,customTruncated:count>rows.length,
  notice:"Built-in methodology definitions are application presets. Custom blueprints are local-development records. Applied projects receive a frozen snapshot."},{headers});
}
export async function POST(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const parsed=methodologyCreate.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid methodology blueprint",issues:parsed.error.flatten()},{status:400,headers});
 if(builtins.some(x=>x.title===parsed.data.title))return NextResponse.json({error:"Reserved built-in methodology title"},{status:409,headers});
 try{
  const user=await getSession(request);
  const created=await prisma.consultingMethodology.create({data:{...parsed.data,
   blueprint:parsed.data.blueprint as Prisma.InputJsonValue,createdBy:user!.username}});
  return NextResponse.json({methodology:{id:created.id,title:created.title,description:created.description,
   revision:created.revision,blueprint:parsed.data.blueprint,builtin:false}},{status:201,headers});
 }catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")
   return NextResponse.json({error:"Methodology title already exists"},{status:409,headers});
  throw error;
 }
}
