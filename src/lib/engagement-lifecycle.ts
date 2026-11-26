import {z} from "zod";
export const lifecycleStages=["PROPOSED","SCOPED","DELIVERING","READY_FOR_HANDOFF","CLOSED"] as const;
const day=z.string().date().nullable();
const short=z.string().trim().min(2).max(180);
export const milestone=z.object({
 id:z.string().uuid(),title:short,owner:z.string().trim().max(120),
 dueDate:day,status:z.enum(["PLANNED","IN_PROGRESS","DONE"]),note:z.string().trim().max(2000)
}).strict();
export const deliverable=z.object({
 id:z.string().uuid(),title:short,description:z.string().trim().max(2000),
 auditId:z.string().cuid().nullable(),dueDate:day,
 status:z.enum(["PLANNED","PREPARING","SUBMITTED","ACCEPTED"]),
 acceptanceNote:z.string().trim().max(2000),acceptedBy:z.string().trim().max(120)
}).strict();
export const input=z.object({
 expectedRevision:z.number().int().min(0),
 objective:z.string().trim().max(3000),scope:z.string().trim().max(6000),
 exclusions:z.string().trim().max(3000),commercialNote:z.string().trim().max(3000),
 stage:z.enum(lifecycleStages),
 milestones:z.array(milestone).max(80),deliverables:z.array(deliverable).max(80),
 summary:z.string().trim().min(6).max(500)
}).strict().superRefine((value,ctx)=>{
 for(const name of ["milestones","deliverables"] as const){
  const ids=value[name].map(a=>a.id);
  if(ids.length!==new Set(ids).size)ctx.addIssue({code:"custom",path:[name],message:"Duplicate identifiers"});
 }
 for(const [i,d] of value.deliverables.entries()){
  if(d.status==="ACCEPTED"&&(!d.acceptanceNote||!d.acceptedBy))
   ctx.addIssue({code:"custom",path:["deliverables",i],message:"Internal acceptance requires a note and named recorder"});
  if(d.status!=="ACCEPTED"&&(d.acceptanceNote||d.acceptedBy))
   ctx.addIssue({code:"custom",path:["deliverables",i],message:"Clear acceptance fields unless accepted"});
 }
 if(value.stage==="CLOSED"){
  if(!value.scope||!value.objective||!value.milestones.length||!value.deliverables.length||
   value.milestones.some(m=>m.status!=="DONE")||value.deliverables.some(d=>d.status!=="ACCEPTED"))
    ctx.addIssue({code:"custom",path:["stage"],message:"Closure requires defined scope/objective, all milestones done and all deliverables accepted internally"});
 }
 if(value.stage==="READY_FOR_HANDOFF"&&!value.deliverables.some(d=>d.status==="SUBMITTED"||d.status==="ACCEPTED"))
  ctx.addIssue({code:"custom",path:["stage"],message:"At least one submitted or accepted deliverable is required"});
});
export const emptyLifecycle={
 revision:0,objective:"",scope:"",exclusions:"",commercialNote:"",stage:"PROPOSED" as const,
 milestones:[] as z.infer<typeof milestone>[],deliverables:[] as z.infer<typeof deliverable>[]
};
export function asItems<T>(value:unknown,parser:z.ZodType<T>):T[]{
 const result=z.array(parser).safeParse(value);
 return result.success?result.data:[];
}
