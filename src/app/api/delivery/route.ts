import {NextResponse} from "next/server";
import {z} from "zod";
import {requireLocalPrototype} from "@/lib/dev-api";
import {loadDelivery,filterDelivery,deliveryCalendar} from "@/lib/delivery-planner";
export const runtime="nodejs";export const dynamic="force-dynamic";
const params=z.object({
 client:z.string().min(1).max(160).optional(),owner:z.string().min(1).max(160).optional(),
 kind:z.enum(["AUDIT","ACTION"]).optional(),
 range:z.enum(["ALL","OVERDUE","NEXT_7","NEXT_30","NEXT_90","UNSCHEDULED"]).optional(),
 format:z.enum(["json","ics"]).default("json")
}).strict();
export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const url=new URL(request.url);
 const query=Object.fromEntries(url.searchParams.entries());
 if([...url.searchParams.keys()].length!==Object.keys(query).length)return NextResponse.json({error:"Duplicate filters not supported"},{status:400});
 const parsed=params.safeParse(query);
 if(!parsed.success)return NextResponse.json({error:"Invalid delivery filter"},{status:400,headers:{"Cache-Control":"private, no-store"}});
 const {format,...filters}=parsed.data;
 const view=filterDelivery(await loadDelivery(),filters);
 if(!view)return NextResponse.json({error:"Unknown client or owner"},{status:400,headers:{"Cache-Control":"private, no-store"}});
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 if(format==="ics")return new NextResponse(deliveryCalendar(view),{headers:{...headers,"Content-Type":"text/calendar; charset=utf-8",
  "Content-Disposition":'attachment; filename="surface-audit-delivery.ics"'}});
 return NextResponse.json(view,{headers});
}
