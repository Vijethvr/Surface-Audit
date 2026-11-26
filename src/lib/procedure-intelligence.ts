import {createHash} from "node:crypto";
import {z} from "zod";
export const noteInput=z.object({procedure:z.string().trim().min(40).max(16000)}).strict();
export const proposal=z.object({
 code:z.string().min(1).max(30),
 excerpt:z.string().min(5).max(1500),
 observation:z.string().min(5).max(1500),
 reference:z.string().max(500),
 confidence:z.enum(["high","medium","low"]),
 assessment:z.enum(["Not assessed","Conforms","Nonconformity","Not applicable"]),
 question:z.string().min(8).max(500)
}).strict();
export const analysisSchema=z.object({
 proposals:z.array(proposal).max(100),
 additionalQuestions:z.array(z.string().min(8).max(500)).max(30)
}).strict();
export type Requirement={code:string;text:string};
export type Proposal=z.infer<typeof proposal>;
const stopWords=new Set(["the","and","for","with","that","from","this","were","was","have","been","each","what","into","used","using","then","when","where","will","shall","must","should","record","records","review","reviewed","confirm","verified","measurement","audit","evidence","documented","identified","assessed","process","procedure","check","checked","data","control","system","appropriate","applicable","supported","their","they","these","after","before"]);
const tokens=(text:string)=>[...new Set((text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)||[]).filter(x=>!stopWords.has(x)))];
const synonyms:Record<string,string[]>={
 calibration:["certificate","calibrated","calibration","expiry","interval","traceability","traceable"],
 instrument:["equipment","gage","gauge","probe","sensor","profilometer","micrometer","machine"],
 uncertainty:["budget","repeatability","reproducibility","uncertainty","coverage","expanded"],
 competence:["training","operator","personnel","qualified","authorized","qualification"],
 specification:["drawing","tolerance","limit","revision","blueprint","specification"],
 environment:["temperature","humidity","vibration","cleaning","ambient","environment"],
 decision:["pass","fail","accept","reject","conformity","decision","rule"],
 reference:["master","standard","artifact","reference","traceability"],
 sampling:["sample","samples","specimen","sampling","part"],
 supplier:["vendor","supplier","subcontractor","incoming"],
 procedure:["instruction","method","procedure","protocol","work"]
};
function expanded(input:string){
 const keys=tokens(input);const found=new Set(keys);
 for(const [key,alts] of Object.entries(synonyms))if(found.has(key)||alts.some(x=>found.has(x)))for(const word of [key,...alts])found.add(word);
 return found;
}
function paragraphs(input:string){
 // Keep original exact spans; no generated evidence quotes.
 return input.split(/(?<=[.!?])\s+|\n+/).map(x=>x.trim()).filter(x=>x.length>=12).slice(0,120);
}
function proposedQuestion(r:Requirement){
 const lower=r.text.toLowerCase();
 if(/calibra|traceab|reference/.test(lower))return "Which certificate/reference identifiers, due dates and traceability evidence were checked for "+r.code+"?";
 if(/uncertainty|decision|tolerance|conformity/.test(lower))return "What quantitative limit, decision rule and uncertainty evidence supports "+r.code+"?";
 if(/operator|competence|train/.test(lower))return "What authorization or competence records were inspected for "+r.code+"?";
 if(/environment|sample|temperature/.test(lower))return "Which measured environmental or sample conditions were documented for "+r.code+"?";
 return "What exact procedure step, observation, record ID and outcome demonstrates "+r.code+"?";
}
const referencePattern=/\b(?:[A-Z]{2,8}[-_/]\d{2,}[-_/A-Z0-9]*|(?:cert(?:ificate)?|report|drawing|record|ref(?:erence)?)\s*(?:no\.?|id|#|:)?\s*[A-Z0-9][A-Z0-9-]{3,})\b/i;
function hasNegative(text:string){
 return /\b(missing|expired|not available|not found|not performed|failed|overdue|out.of.tolerance|no evidence|absent|unverified|incomplete)\b/i.test(text);
}
export function localAnalyze(procedure:string,requirements:Requirement[]){
 const fragments=paragraphs(procedure);
 const results:Proposal[]=[];
 for(const req of requirements){
  const concept=expanded(req.text);
  const matched=fragments.map(fragment=>{
   const terms=expanded(fragment);
   const base=tokens(req.text);
   const hits=base.filter(word=>terms.has(word));
   return {fragment,score:hits.length/(Math.min(base.length,8)||1),hits:hits.length};
  }).sort((a,b)=>b.score-a.score||b.hits-a.hits);
  const top=matched[0];
  if(!top||top.hits===0||top.score<0.12)continue;
  const evidence=(top.fragment.match(referencePattern)||[])[0]??"";
  const confidence=top.score>=0.5&&top.hits>=2?"high":top.score>=0.25?"medium":"low";
  results.push({code:req.code,excerpt:top.fragment.slice(0,1500),observation:top.fragment.slice(0,1500),
   reference:evidence.slice(0,500),confidence,
   // Never claim conformance from mere narrative; negative assertions are review flags.
   assessment:"Not assessed",question:hasNegative(top.fragment)?
    "Potential issue in your procedure: is this a confirmed nonconformity? What evidence, requirement and corrective action support that decision?":
    proposedQuestion(req)});
 }
 return {proposals:results,additionalQuestions:requirements.filter(r=>!results.some(p=>p.code===r.code)).map(proposedQuestion).slice(0,30)};
}
export function normalizeAnalysis(candidate:unknown,procedure:string,requirements:Requirement[]){
 const parsed=analysisSchema.safeParse(candidate);
 if(!parsed.success)throw Error("Invalid structured analysis");
 const codes=new Set(requirements.map(r=>r.code));
 const seen=new Set<string>();
 const proposals=parsed.data.proposals.filter(p=>{
  if(!codes.has(p.code)||seen.has(p.code))return false;
  if(!procedure.includes(p.excerpt))return false;
  seen.add(p.code);return true;
 }).map(p=>({
  ...p,
  // Only exact source passages may become proposed assessment observations.
  observation:p.excerpt,
  reference:p.reference&&procedure.includes(p.reference)?p.reference:"",
  // Model interpretation cannot be written as a final technical judgement.
  assessment:"Not assessed" as const
 }));
 return {proposals,additionalQuestions:parsed.data.additionalQuestions};
}
export function digestProcedure(procedure:string){return createHash("sha256").update(procedure).digest("hex")}
export function combineQuestions(requirements:Requirement[],proposals:Proposal[],extra:string[]){
 const matched=new Set(proposals.map(p=>p.code));
 const missing=requirements.filter(r=>!matched.has(r.code)).map(proposedQuestion);
 return [...new Set([...missing,...extra])].slice(0,40);
}
