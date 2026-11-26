import {z} from "zod";
import {localAnalyze,digestProcedure,type Requirement} from "@/lib/procedure-intelligence";

export const dialogueInput=z.object({
 expectedRevision:z.number().int().nonnegative(),
 kind:z.enum(["PROCEDURE","CLARIFICATION"]),
 text:z.string().trim().min(12).max(1800),
 requirementCode:z.string().min(1).max(30).nullable()
}).strict();
export type Turn={id:string;sequence:number;kind:string;text:string;requirementCode:string|null;author:string;createdAt:Date};
export const MAX_TURNS=30,MAX_TRANSCRIPT=16000;
const gap=/\b(not performed|not done|did not (?:perform|check|verify|measure|review|inspect|record)|was not (?:performed|checked|verified|reviewed)|no (?:measurement|inspection|review) (?:was )?performed|skipped|omitted)\b/i;
const noRecord=/\b(no (?:certificate|document|record|documentation|evidence|result)|(?:certificate|document|record|documentation|evidence|result) (?:was )?(?:missing|unavailable|not found)|not (?:documented|recorded|available)|could not (?:locate|find|obtain)|pending (?:evidence|certificate|record))\b/i;
const exception=/\b(expired|overdue|failed|out.of.tolerance|incorrect|discrepancy|outside limits|nonconforming|nonconformity)\b/i;
export type Coverage="already_recorded"|"possible_gap"|"documentation_gap"|"possible_exception"|"described"|"unmentioned";
export function transcript(turns:Pick<Turn,"text">[]){return turns.map(t=>t.text.trim()).join("\n")}
export function followupFor(req:Requirement,coverage:Coverage){
 const head=req.code+" — "+req.text;
 if(coverage==="possible_gap")return "For "+head+": was this step actually omitted, or did it occur but was not described? What corrective step is planned?";
 if(coverage==="documentation_gap")return "For "+head+": was the work performed but the evidence unavailable? Which record, owner and due date will resolve it?";
 if(coverage==="possible_exception")return "For "+head+": what was the observed nonconformance, acceptance limit and supporting evidence? Should a formal finding/CAPA be raised?";
 if(coverage==="described")return "For "+head+": what exact record, measurement result or reference verifies the described step? Was the result acceptable under the applicable criterion?";
 return "For "+head+": describe what you actually did, the relevant acceptance criterion, and the document or measurement evidence. If not performed, say so.";
}
export function buildDialogueView(turns:Turn[],requirements:Requirement[],saved:Record<string,{answer?:string}>){
 const procedure=transcript(turns);
 const proposals=procedure.length>=12?localAnalyze(procedure,requirements).proposals:[];
 const mapping=requirements.map(r=>{
  const fragments=proposals.filter(p=>p.code===r.code);
  // A response tied to a specific requirement is always relevant to that
  // requirement even if local keyword matching missed a technical synonym.
  const direct=turns.filter(t=>t.requirementCode===r.code);
  // Prefer an explicit question response over inferred keyword matches elsewhere.
  const cited=direct.length?[direct[direct.length-1].text]:fragments.length?[fragments[0].excerpt]:[];
  const excerpt=cited[0]??null;
  let coverage:Coverage="unmentioned";
  if(excerpt){
   if(gap.test(excerpt))coverage="possible_gap";
   else if(noRecord.test(excerpt))coverage="documentation_gap";
   else if(exception.test(excerpt))coverage="possible_exception";
   else coverage="described";
  }
  if(saved[r.code]?.answer&&saved[r.code].answer!=="Not assessed")coverage="already_recorded";
  const linked=turns.filter(t=>t.requirementCode===r.code||Boolean(excerpt&&t.text.includes(excerpt)));
  return {code:r.code,title:r.text,coverage,excerpt,
   sourceTurnIds:[...new Set(linked.map(t=>t.id))],
   followUp:followupFor(r,coverage),
   savedAnswer:saved[r.code]?.answer??"Not assessed"};
 });
 // Preference: explicitly reported missing work/evidence, then unmentioned,
 // followed by weakly supported claims, rather than repeating prior answers.
 const rank:Record<Coverage,number>={possible_gap:0,documentation_gap:1,possible_exception:2,unmentioned:3,described:4,already_recorded:5};
 const priorities=mapping.filter(m=>m.coverage!=="already_recorded")
  .sort((a,b)=>rank[a.coverage]-rank[b.coverage]);
 return {transcript:procedure,transcriptSha256:digestProcedure(procedure),
  coverage:mapping,
  nextQuestions:priorities.slice(0,5).map(x=>({code:x.code,question:x.followUp,coverage:x.coverage})),
  metrics:{requirements:requirements.length,withPossibleNarrative:mapping.filter(x=>x.coverage!=="unmentioned"&&x.coverage!=="already_recorded").length,
   unmentioned:mapping.filter(x=>x.coverage==="unmentioned").length,
   apparentGaps:mapping.filter(x=>["possible_gap","documentation_gap","possible_exception"].includes(x.coverage)).length,
   previouslyAssessed:mapping.filter(x=>x.coverage==="already_recorded").length},
  warning:"Narrative coverage is only a clue about what was described. It does not establish whether work was performed, evidence is genuine, or a requirement conforms."};
}
