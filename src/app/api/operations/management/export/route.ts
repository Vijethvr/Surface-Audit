import {NextResponse} from "next/server";
import {requireLocalPrototype} from "@/lib/dev-api";
import {loadManagementReview} from "@/lib/management-review";
export const runtime="nodejs";export const dynamic="force-dynamic";
function csv(value:unknown){
 const raw=value==null?"":String(value);
 // Prevent dangerous spreadsheet formula execution, including whitespace prefixes.
 const safe=/^[\s\uFEFF]*[=+@\-]/u.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const url=new URL(request.url);
 const client=url.searchParams.get("client");
 if(client!==null&&(client.length>160||client.trim()!==client))
  return NextResponse.json({error:"Invalid client filter"},{status:400});
 const format=url.searchParams.get("format")??"json";
 if(format!=="json"&&format!=="csv")return NextResponse.json({error:"Unsupported export format"},{status:400});
 const review=await loadManagementReview(client||undefined);
 if(!review)return NextResponse.json({error:"Unknown client filter"},{status:404});
 const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
 if(format==="json")return new Response(JSON.stringify(review,null,2),{headers:{...headers,
  "Content-Type":"application/json; charset=utf-8",
  "Content-Disposition":'attachment; filename="surface-management-review.json"'}});
 const columns=["client","score","audits","openActions","overdueActions","highCriticalFindings","missingDueDates","missingOwners"] as const;
 const values=review.topRiskClients;
 const lines=[
  ["Scope",review.scope.warning],
  ["As of",review.asOf],
  ["Client",review.selectedClient??"All sampled clients"],
  [],
  [...columns],
  ...values.map(row=>columns.map(col=>row[col]))
 ];
 const body="\uFEFF"+lines.map(row=>row.map(csv).join(",")).join("\r\n")+"\r\n";
 return new Response(body,{headers:{...headers,"Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":'attachment; filename="surface-management-risks.csv"'}});
}
