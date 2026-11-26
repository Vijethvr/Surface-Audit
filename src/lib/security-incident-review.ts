import {prisma} from "@/lib/db";
import {securityEventTypes} from "@/lib/security-events";

export const incidentWindows=[24,168,720] as const;
type WindowHours=(typeof incidentWindows)[number];
export function parseIncidentQuery(url:URL){
 const hours=Number(url.searchParams.get("hours")??"168");
 if(!incidentWindows.includes(hours as WindowHours))throw Error("hours must be 24, 168 or 720");
 const type=url.searchParams.get("type");
 if(type!==null&&!securityEventTypes.includes(type as typeof securityEventTypes[number]))
  throw Error("Unknown security event type");
 const limit=Number(url.searchParams.get("limit")??"100");
 if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error("limit must be 1 to 500");
 return {hours:hours as WindowHours,type,limit};
}
export async function loadIncidentReview(query:ReturnType<typeof parseIncidentQuery>){
 const from=new Date(Date.now()-query.hours*3600000);
 const where={createdAt:{gte:from},...(query.type?{eventType:query.type}:{})};
 const [total,grouped,events]=await prisma.$transaction([
  prisma.securityEvent.count({where}),
  prisma.securityEvent.groupBy({by:["eventType","outcome"],where,_count:{_all:true}}),
  prisma.securityEvent.findMany({where,select:{
   id:true,createdAt:true,eventType:true,outcome:true,actorUsername:true,subjectUsername:true
  },orderBy:[{createdAt:"desc"},{id:"desc"}],take:query.limit})
 ]);
 const summary=grouped.map(row=>({type:row.eventType,outcome:row.outcome,count:row._count._all}))
  .sort((a,b)=>b.count-a.count||a.type.localeCompare(b.type));
 const suspicious=summary.filter(row=>["LOGIN_FAILED","LOGIN_LOCKED"].includes(row.type))
  .reduce((sum,row)=>sum+row.count,0);
 return {generatedAt:new Date().toISOString(),windowHours:query.hours,from:from.toISOString(),
  type:query.type,total,returned:events.length,truncated:total>events.length,
  authenticationFailuresAndLockouts:suspicious,summary,events};
}
// Defend Excel/Calc against formula execution, including whitespace-prefixed formulas.
function cell(value:unknown){
 const raw=String(value??"");
 const safe=/^\s*[=+@\-\t\r]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function incidentCsv(report:Awaited<ReturnType<typeof loadIncidentReview>>){
 const head=["Recorded (UTC)","Event type","Outcome","Actor","Subject"];
 const lines=report.events.map(e=>[e.createdAt.toISOString(),e.eventType,e.outcome,
  e.actorUsername??"",e.subjectUsername??""].map(cell).join(","));
 return "\uFEFF"+[head.map(cell).join(","),...lines].join("\r\n")+"\r\n";
}
