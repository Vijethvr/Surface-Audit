import {prisma} from "@/lib/db";

// Delivery planning is a live, explicitly bounded projection of the existing
// audit and corrective-action records, not a new authoritative schedule.
export type DeliveryItem={
 id:string;kind:"AUDIT"|"ACTION";auditId:string;auditTitle:string;client:string;
 project:string;title:string;owner:string;date:string|null;status:string;
 severity:string;findingId:string|null;daysFromToday:number|null;
 bucket:"OVERDUE"|"TODAY"|"NEXT_7"|"NEXT_30"|"NEXT_90"|"LATER"|"UNSCHEDULED";
};
const LIMIT=500;
const millis=86400000;
const isoDay=(date:Date)=>date.toISOString().slice(0,10);
const dayIndex=(date:Date)=>Math.floor(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())/millis);
function classify(date:Date|null,today:number):Pick<DeliveryItem,"date"|"daysFromToday"|"bucket">{
 if(!date)return {date:null,daysFromToday:null,bucket:"UNSCHEDULED"};
 const days=dayIndex(date)-today;
 return {date:isoDay(date),daysFromToday:days,bucket:days<0?"OVERDUE":days===0?"TODAY":days<=7?"NEXT_7":days<=30?"NEXT_30":days<=90?"NEXT_90":"LATER"};
}
export async function loadDelivery(){
 const [audits,actions,remainingAudits,remainingActions]=await Promise.all([
  prisma.audit.findMany({where:{status:{not:"COMPLETED"}},select:{
   id:true,title:true,status:true,targetDate:true,client:{select:{name:true}},
   project:{select:{name:true}}},orderBy:[{createdAt:"desc"},{id:"asc"}],take:LIMIT}),
  prisma.correctiveAction.findMany({where:{status:{not:"VERIFIED"}},select:{
   id:true,description:true,owner:true,dueDate:true,status:true,
   finding:{select:{id:true,severity:true,audit:{select:{id:true,title:true,client:{select:{name:true}},project:{select:{name:true}}}}}}},orderBy:[{createdAt:"desc"},{id:"asc"}],take:LIMIT}),
  prisma.audit.count({where:{status:{not:"COMPLETED"}}}),
  prisma.correctiveAction.count({where:{status:{not:"VERIFIED"}}})
 ]);
 const now=new Date();const today=dayIndex(now);
 const rows:DeliveryItem[]=[
  ...audits.map(a=>({id:"audit:"+a.id,kind:"AUDIT" as const,auditId:a.id,auditTitle:a.title,client:a.client.name,
   project:a.project?.name??"",title:a.title,owner:"",status:a.status,severity:"",findingId:null,...classify(a.targetDate,today)})),
  ...actions.map(a=>({id:"action:"+a.id,kind:"ACTION" as const,auditId:a.finding.audit.id,auditTitle:a.finding.audit.title,
   client:a.finding.audit.client.name,project:a.finding.audit.project?.name??"",title:a.description,owner:a.owner,
   status:a.status,severity:a.finding.severity,findingId:a.finding.id,...classify(a.dueDate,today)}))
 ];
 // Stable urgency order: overdue first, then the next deadlines, then undated work.
 rows.sort((a,b)=>(a.daysFromToday??Number.POSITIVE_INFINITY)-(b.daysFromToday??Number.POSITIVE_INFINITY)||a.client.localeCompare(b.client)||a.id.localeCompare(b.id));
 return {asOf:now.toISOString(),today:isoDay(now),scope:{
  limitPerCategory:LIMIT,activeAuditTotal:remainingAudits,unverifiedActionTotal:remainingActions,
  sampledAudits:audits.length,sampledActions:actions.length,
  truncated:remainingAudits>audits.length||remainingActions>actions.length,
  notice:"Items are from the newest 500 active audits and newest 500 unverified actions independently. If truncated, displayed totals and client/owner counts describe the sample only."
 },items:rows};
}
export function filterDelivery(data:Awaited<ReturnType<typeof loadDelivery>>,filters:{client?:string;owner?:string;kind?:string;range?:string}){
 const {client,owner,kind,range}=filters;
 const clients=[...new Set(data.items.map(a=>a.client))].sort((a,b)=>a.localeCompare(b));
 const owners=[...new Set(data.items.filter(a=>a.kind==="ACTION"&&a.owner.trim()).map(a=>a.owner.trim()))].sort((a,b)=>a.localeCompare(b));
 if((client&&!clients.includes(client))||(owner&&!owners.includes(owner)))return null;
 const filtered=data.items.filter(a=>
  (!client||a.client===client)&&(!owner||a.owner===owner)&&(!kind||a.kind===kind)&&
  (!range||range==="ALL"||
   (range==="UNSCHEDULED"?a.bucket==="UNSCHEDULED":
    range==="OVERDUE"?a.bucket==="OVERDUE":
    range==="NEXT_7"?a.daysFromToday!==null&&a.daysFromToday>=0&&a.daysFromToday<=7:
    range==="NEXT_30"?a.daysFromToday!==null&&a.daysFromToday>=0&&a.daysFromToday<=30:
    range==="NEXT_90"?a.daysFromToday!==null&&a.daysFromToday>=0&&a.daysFromToday<=90:false))
 );
 const metrics={overdue:filtered.filter(a=>a.bucket==="OVERDUE").length,dueToday:filtered.filter(a=>a.bucket==="TODAY").length,
  next7:filtered.filter(a=>a.daysFromToday!==null&&a.daysFromToday>=0&&a.daysFromToday<=7).length,
  next30:filtered.filter(a=>a.daysFromToday!==null&&a.daysFromToday>=0&&a.daysFromToday<=30).length,
  unscheduled:filtered.filter(a=>a.bucket==="UNSCHEDULED").length,activeAudits:filtered.filter(a=>a.kind==="AUDIT").length,
  outstandingActions:filtered.filter(a=>a.kind==="ACTION").length};
 const timeline=Array.from({length:13},(_,i)=>{const start=i*7,end=start+6;return {week:i+1,
  start:new Date(Date.parse(data.today+"T00:00:00Z")+start*millis).toISOString().slice(0,10),
  due:filtered.filter(a=>a.daysFromToday!==null&&a.daysFromToday>=start&&a.daysFromToday<=end).length}});
 return {...data,filters:{client:client??null,owner:owner??null,kind:kind??null,range:range??"ALL"},
  clients,owners,metrics,timeline,items:filtered};
}
function icsEscape(value:string){return value.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/[,;]/g,c=>"\\"+c)}
function foldLine(line:string){
 // Limit calendar content length while folding long UTF-8 lines at byte boundaries.
 const chunks:string[]=[];let current="";let size=0;
 for(const ch of line){const n=Buffer.byteLength(ch);if(size+n>70){chunks.push(current);current=" ";size=1}current+=ch;size+=n}
 chunks.push(current);return chunks.join("\r\n");
}
export function deliveryCalendar(data:ReturnType<typeof filterDelivery>){
 if(!data)throw Error("Invalid filters");
 const now=data.asOf.replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
 const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//SURFACE Audit//Local Delivery Planner//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:SURFACE Audit Commitments"];
 for(const item of data.items){
  if(!item.date)continue;
  const start=item.date.replaceAll("-","");
  const end=new Date(Date.parse(item.date+"T00:00:00Z")+millis).toISOString().slice(0,10).replaceAll("-","");
  const detail=[item.client,item.auditTitle,item.kind==="ACTION"?"Corrective action":"Audit target",
   item.owner?"Owner: "+item.owner:"",item.status].filter(Boolean).join(" | ");
  lines.push("BEGIN:VEVENT","UID:"+item.id.replace(":","-")+"@surface-audit-local",
   "DTSTAMP:"+now,"DTSTART;VALUE=DATE:"+start,"DTEND;VALUE=DATE:"+end,
   "SUMMARY:"+icsEscape(item.kind==="ACTION"?"CAPA: "+item.title:"Audit: "+item.title),
   "DESCRIPTION:"+icsEscape(detail),"STATUS:TENTATIVE","END:VEVENT");
 }
 lines.push("END:VCALENDAR");
 return lines.map(foldLine).join("\r\n")+"\r\n";
}
