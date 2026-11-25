import {prisma} from "@/lib/db";
import {buildAuditReport} from "@/lib/audit-report";
import {reportDigest} from "@/lib/report-snapshot";

// Remove only volatile presentation / history fields. The digest still binds
// the approval to checklist answers, evidence manifest, findings and CAPA.
export function reviewBasisDigest(report:NonNullable<Awaited<ReturnType<typeof buildAuditReport>>>){
 const {generatedAt: _generatedAt,activityCount: _activityCount,...basis}=report;
 void _generatedAt;void _activityCount;
 return reportDigest(basis);
}
export async function auditReviewState(auditId:string){
 const [audit,latestReview,latestMutation]=await Promise.all([
  prisma.audit.findUnique({where:{id:auditId},select:{status:true}}),
  prisma.auditReview.findFirst({where:{auditId},orderBy:[{reviewedAt:"desc"},{id:"desc"}]}),
  prisma.auditEvent.findFirst({where:{auditId,action:{notIn:["REVIEW_APPROVED","REVIEW_REJECTED","AUDIT_SEALED"]}},orderBy:[{createdAt:"desc"},{id:"desc"}]})
 ]);
 const timeValid=Boolean(latestReview&&latestReview.decision==="APPROVED"&&(!latestMutation||latestReview.reviewedAt>=latestMutation.createdAt));
 let contentValid=false;
 if(timeValid&&latestReview?.reportDigest){
  if(audit?.status==="COMPLETED")contentValid=true;
  else{
   const report=await buildAuditReport(auditId);
   contentValid=Boolean(report&&reviewBasisDigest(report)===latestReview.reportDigest);
  }
 }
 return {current:timeValid&&contentValid,latestReview,latestMutation};
}
