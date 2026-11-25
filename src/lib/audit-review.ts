import {prisma} from "@/lib/db";
export async function auditReviewState(auditId:string){
 const [latestReview,latestMutation]=await Promise.all([
  prisma.auditReview.findFirst({where:{auditId},orderBy:{reviewedAt:"desc"}}),
  prisma.auditEvent.findFirst({where:{auditId,action:{notIn:["REVIEW_APPROVED","REVIEW_REJECTED","AUDIT_UPDATED_COMPLETED"]}},orderBy:{createdAt:"desc"}})
 ]);
 const current=Boolean(latestReview&&latestReview.decision==="APPROVED"&&(!latestMutation||latestReview.reviewedAt>=latestMutation.createdAt));
 return {current,latestReview,latestMutation};
}
