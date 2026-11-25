import {NextResponse} from "next/server";
import {requireLocalPrototype} from "@/lib/dev-api";
import {loadOperations} from "@/lib/operations";
export const runtime="nodejs";export const dynamic="force-dynamic";
function csvField(value:unknown){
 const text=value===null||value===undefined?"":String(value);
 // Prefix spreadsheet formula starts; exports must be safe to open in Excel.
 const safe=/^[=+@\-\t\r]/.test(text)?"'"+text:text;
 return '"'+safe.replaceAll('"','""')+'"';
}
export async function GET(request:Request){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const type=new URL(request.url).searchParams.get("type");
 if(type!=="audits"&&type!=="findings"&&type!=="actions"&&type!=="evidence")
  return NextResponse.json({error:"Unknown export type"},{status:400});
 const data=await loadOperations();
 const rows=data[type];
 const columns=type==="audits"?["id","title","client","project","status","createdAt","updatedAt","sealed","sha256"]:
  type==="findings"?["id","auditId","auditTitle","client","code","title","severity","status","actions","openActions","createdAt"]:
  type==="actions"?["id","findingId","auditId","auditTitle","client","requirementCode","description","owner","status","dueDate","overdue","closureEvidence","verifiedBy"]:
  ["id","auditId","auditTitle","client","requirementCode","reference","description","createdAt"];
 const csv="\uFEFF"+columns.map(csvField).join(",")+"\r\n"+rows.map(row=>columns.map(key=>csvField((row as unknown as Record<string,unknown>)[key])).join(",")).join("\r\n")+"\r\n";
 return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="surface-audit-'+type+'.csv"',"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}