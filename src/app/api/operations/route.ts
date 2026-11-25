import {NextResponse} from "next/server";
import {requireLocalPrototype} from "@/lib/dev-api";
import {loadOperations} from "@/lib/operations";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:Request){
 const denial=requireLocalPrototype(request);if(denial)return denial;
 const data=await loadOperations();
 return NextResponse.json(data,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}