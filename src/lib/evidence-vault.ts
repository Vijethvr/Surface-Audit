import {createHash} from "node:crypto";
export const maxEvidenceBytes=1024*1024;
export const maxEvidencePerAudit=40;
export const evidenceTypes=new Set(["application/pdf","image/png","image/jpeg","text/plain"]);
export function evidenceDigest(bytes:Uint8Array){return createHash("sha256").update(bytes).digest("hex")}
export function inspectEvidence(mime:string,bytes:Uint8Array){
 if(!evidenceTypes.has(mime)||bytes.length<1||bytes.length>maxEvidenceBytes)return false;
 if(mime==="application/pdf")return bytes.length>=8&&Buffer.from(bytes.subarray(0,5)).toString("ascii")==="%PDF-";
 if(mime==="image/png")return bytes.length>=8&&Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==="image/jpeg")return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
 try{const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);return !text.includes("\u0000")}catch{return false}
}
export function safeFilename(name:string){
 const clean=name.replace(/[\\/\r\n\x00-\x1f\x7f"<>:|?*]/g,"_").replace(/[^\x20-\x7e]/g,"_").slice(0,120).trim();
 return clean&&clean!=="."&&clean!==".."?clean:"evidence-file";
}
