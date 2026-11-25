export type Status = "Scheduled" | "In progress" | "In review" | "Completed";
export type Audit = { id:string; title:string; client:string; type:string; status:Status; progress:number; revision?:number; date:string };
export const initialAudits: Audit[] = [
{id:"AUD-2026-041",title:"Surface measurement procedure assessment",client:"Nordic Precision AB",type:"Measurement assurance",status:"In progress",progress:72,date:"30 Nov 2026"},
{id:"AUD-2026-040",title:"Calibration & traceability review",client:"AeroForm Components",type:"Equipment verification",status:"In review",progress:90,date:"27 Nov 2026"},
{id:"AUD-2026-039",title:"Supplier metrology process audit",client:"Precision Works Ltd",type:"Supplier audit",status:"Completed",progress:100,date:"18 Nov 2026"},
{id:"AUD-2026-038",title:"Operator competency & procedure audit",client:"Nordic Precision AB",type:"Process assurance",status:"Scheduled",progress:0,date:"04 Dec 2026"},
{id:"AUD-2026-037",title:"Measurement reporting process review",client:"AeroForm Components",type:"Documentation",status:"Completed",progress:100,date:"12 Nov 2026"},
];
export const findings = [
{id:"F-021",title:"Calibration certificate requires renewal",audit:"AUD-2026-041",severity:"High",due:"27 Nov"},
{id:"F-020",title:"Outdated measurement procedure reference",audit:"AUD-2026-041",severity:"Medium",due:"02 Dec"},
{id:"F-019",title:"Operator competency evidence incomplete",audit:"AUD-2026-040",severity:"Low",due:"05 Dec"}
];
