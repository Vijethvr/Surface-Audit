import {z} from "zod";

const checklist=z.object({code:z.string().trim().regex(/^[A-Z0-9_-]{2,30}$/),text:z.string().trim().min(5).max(500)}).strict();
export const auditBlueprint=z.object({
 key:z.string().trim().regex(/^[a-z][a-z0-9-]{1,39}$/),
 title:z.string().trim().min(3).max(160),
 type:z.string().trim().min(3).max(120),
 offsetDays:z.number().int().min(0).max(365).nullable(),
 criteria:z.array(checklist).min(1).max(100)
}).strict().superRefine((a,c)=>{
 if(new Set(a.criteria.map(x=>x.code)).size!==a.criteria.length)c.addIssue({code:"custom",message:"Duplicate requirement codes"});
});
export const blueprint=z.object({
 objective:z.string().trim().min(10).max(3000),
 scope:z.string().trim().min(10).max(6000),
 exclusions:z.string().trim().max(3000),
 milestones:z.array(z.object({title:z.string().trim().min(3).max(180),owner:z.string().trim().max(120),offsetDays:z.number().int().min(0).max(365).nullable(),note:z.string().trim().max(2000)}).strict()).min(1).max(30),
 audits:z.array(auditBlueprint).min(1).max(15),
 deliverables:z.array(z.object({title:z.string().trim().min(3).max(180),description:z.string().trim().max(2000),
  auditKey:z.string().nullable(),offsetDays:z.number().int().min(0).max(365).nullable()}).strict()).min(1).max(40)
}).strict().superRefine((value,ctx)=>{
 const keys=value.audits.map(a=>a.key);
 if(new Set(keys).size!==keys.length)ctx.addIssue({code:"custom",path:["audits"],message:"Audit keys must be unique"});
 for(const [index,d] of value.deliverables.entries())if(d.auditKey&&!keys.includes(d.auditKey))
  ctx.addIssue({code:"custom",path:["deliverables",index,"auditKey"],message:"Deliverable references unknown audit key"});
});
export const methodologyCreate=z.object({
 title:z.string().trim().min(3).max(160),description:z.string().trim().max(1000),
 revision:z.string().trim().min(1).max(40),blueprint
}).strict();
export const applicationInput=z.object({
 clientId:z.string().cuid(),projectName:z.string().trim().min(2).max(160),
 reference:z.string().trim().max(100).optional(),
 methodologyId:z.string().trim().min(1).max(100),
 startDate:z.string().date(),
 owner:z.string().trim().max(120).optional()
}).strict();
export type Blueprint=z.infer<typeof blueprint>;
export type Methodology={id:string;title:string;description:string;revision:string;blueprint:Blueprint;builtin:boolean};
const req=(...items:[string,string][])=>items.map(([code,text])=>({code,text}));
export const builtins:Methodology[]=[
 {id:"standard:measurement-assurance",title:"Measurement Assurance Baseline",description:"Procedure, instrument, uncertainty, conformity and traceability assessment",revision:"2026.1",builtin:true,
  blueprint:{objective:"Establish a documented baseline of measurement process assurance and traceable decision-making.",
   scope:"Review measurement methods, instrument suitability, calibration evidence, uncertainty handling, competence and conformity decisions.",exclusions:"Not an accredited calibration service or certification of the client's measurement system.",
   milestones:[{title:"Kickoff and documentary collection",owner:"Consulting lead",offsetDays:7,note:"Confirm specification, personnel and evidence access"},
    {title:"Technical measurement-system review",owner:"Metrology specialist",offsetDays:21,note:"Inspect process controls, calibration and uncertainty"},
    {title:"Corrective action and report handoff",owner:"Consulting lead",offsetDays:42,note:"Agree remaining findings and deliverable scope"}],
   audits:[{key:"measurement-system",title:"Measurement-system assurance audit",type:"Measurement assurance",offsetDays:21,
    criteria:req(["MTR-01","Applicable drawing and specification tolerances identified"],["MTR-02","Measurement procedure suitability reviewed"],["MTR-03","Instrument identity and calibration status verified"],["MTR-04","Reference artifact traceability documented"],["MTR-05","Measurement uncertainty approach recorded"],["MTR-06","Decision rule and conformity statement supported"],["MTR-07","Operator authorization and competence evaluated"],["MTR-08","Environment and sampling controls evidenced"])}],
   deliverables:[{title:"Measurement assurance assessment dossier",description:"Technical audit and evidence-linked findings register",auditKey:"measurement-system",offsetDays:35},
    {title:"Management decision and action register",description:"Management summary, proposed corrective actions and accountable owners",auditKey:null,offsetDays:42}]}},
 {id:"standard:supplier-metrology",title:"Supplier Metrology Assessment",description:"Supplier capability, calibration controls and incoming verification workflow",revision:"2026.1",builtin:true,
  blueprint:{objective:"Evaluate supplier measurement-system controls and document gaps affecting supplied part conformity.",
   scope:"Review supplier measurement capability, evidence flow, incoming inspection, gage traceability and corrective action management.",exclusions:"Not a certification of supplier quality system or a substitute for customer acceptance.",
   milestones:[{title:"Supplier planning and evidence request",owner:"Supplier quality lead",offsetDays:10,note:"Agree scope and product family"},
    {title:"On-site or remote technical assessment",owner:"Metrology specialist",offsetDays:30,note:"Review evidence and record findings"},
    {title:"Supplier development plan review",owner:"Engagement owner",offsetDays:50,note:"Prioritize corrective actions and report"}],
   audits:[{key:"supplier-controls",title:"Supplier measurement control audit",type:"Supplier assurance",offsetDays:30,
    criteria:req(["SUP-01","Supplier calibration inventory and intervals reviewed"],["SUP-02","Measurement traceability chain examined"],["SUP-03","Incoming inspection acceptance rules documented"],["SUP-04","Process gage suitability demonstrated"],["SUP-05","Reference master control and storage reviewed"],["SUP-06","Out-of-tolerance response procedure evaluated"])},
    {key:"supplier-capability",title:"Supplier capability and evidence audit",type:"Supplier assurance",offsetDays:40,
    criteria:req(["CAP-01","Measurement study and capability claims substantiated"],["CAP-02","Operator training and standard work reviewed"],["CAP-03","Control plan and inspection frequency matched"],["CAP-04","Supplier corrective-action evidence followed through"])}],
   deliverables:[{title:"Supplier metrology findings report",description:"Audit evidence, findings and disposition",auditKey:"supplier-controls",offsetDays:42},
    {title:"Supplier capability assessment",description:"Control study and evidence maturity review",auditKey:"supplier-capability",offsetDays:46},
    {title:"Prioritized supplier improvement roadmap",description:"Follow-up action plan and internal decision summary",auditKey:null,offsetDays:50}]}},
 {id:"standard:calibration-readiness",title:"Calibration & Traceability Readiness",description:"Practical calibration control review and evidence remediation plan",revision:"2026.1",builtin:true,
  blueprint:{objective:"Prepare instrument traceability and calibration records for a structured technical review.",
   scope:"Verify instrument scope, calibration intervals, certificate references, acceptance decisions and out-of-tolerance controls.",exclusions:"Does not issue calibration certificates or replace accredited laboratory testing.",
   milestones:[{title:"Instrument register reconciliation",owner:"Calibration coordinator",offsetDays:7,note:"Resolve inventory and asset ownership"},
    {title:"Traceability document review",owner:"Metrology engineer",offsetDays:18,note:"Inspect certificate and reference chains"},
    {title:"Remediation and management summary",owner:"Engagement owner",offsetDays:30,note:"Prioritize gaps and controls"}],
   audits:[{key:"traceability",title:"Instrument traceability readiness review",type:"Calibration readiness",offsetDays:18,
    criteria:req(["CAL-01","Instrument inventory and use location confirmed"],["CAL-02","Calibration certificate references and due dates verified"],["CAL-03","Traceability to reference standards substantiated"],["CAL-04","Out-of-tolerance disposition documented"],["CAL-05","Calibration uncertainty and acceptance criteria reviewed"],["CAL-06","Service provider competence and scope evaluated"])}],
   deliverables:[{title:"Calibration readiness audit dossier",description:"Instrument traceability observations and supporting evidence",auditKey:"traceability",offsetDays:23},
    {title:"Traceability remediation register",description:"Open gaps, priority and follow-up milestones",auditKey:null,offsetDays:30}]}}
];
export function offsetDate(start:string,days:number|null){
 if(days===null)return null;
 const base=new Date(start+"T00:00:00.000Z");
 if(Number.isNaN(base.getTime())||base.toISOString().slice(0,10)!==start)throw Error("Invalid start date");
 return new Date(base.getTime()+days*86400000).toISOString().slice(0,10);
}
