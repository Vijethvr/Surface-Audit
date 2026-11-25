import {NextResponse} from "next/server";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {buildAuditReport} from "@/lib/audit-report";
import {auditReviewState,reviewBasisDigest} from "@/lib/audit-review";
import {authConfigured,canReview,getSession,validMutationOrigin} from "@/lib/local-auth";
import {requireLocalPrototype} from "@/lib/dev-api";
export const runtime="nodejs";export const dynamic="force-dynamic";
const schema=z.object({decision:z.enum(["APPROVED","REJECTED"]),note:z.string().trim().min(8).max(4000)});
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const denied=await requireLocalPrototype(request);if(denied)return denied;
 const {id}=await ctx.params;
 const exists=await prisma.audit.findUnique({where:{id},select:{id:true}});
 if(!exists)return NextResponse.json({error:"Audit not found"},{status:404});
 const status=await auditReviewState(id);
 return NextResponse.json({review:status.latestReview,current:status.current},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 if(!authConfigured())return NextResponse.json({error:"Local access disabled"},{status:403});
 const user=await getSession(request);
 if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 if(!validMutationOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 if(!canReview(user.role))return NextResponse.json({error:"Reviewer or administrator role required"},{status:403});
 const {id}=await ctx.params;
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid review decision or note"},{status:400});
 const audit=await prisma.audit.findUnique({where:{id},select:{status:true,record:{select:{preparedBy:true}}}});
 if(!audit)return NextResponse.json({error:"Audit not found"},{status:404});
 if(audit.status!=="IN_REVIEW")return NextResponse.json({error:"Audit must be In review before independent review"},{status:409});
 const state=await auditReviewState(id);
 if(audit.record?.preparedBy===user.username||state.latestMutation?.actor===user.username)return NextResponse.json({error:"The preparing operator cannot review their own assessment"},{status:403});
 const report=await buildAuditReport(id);
 if(parsed.data.decision==="APPROVED"&&!report?.readiness.ready)
  return NextResponse.json({error:"Audit readiness failed",blockers:report?.readiness.blockers??[]},{status:409});
 const review=await prisma.$transaction(async tx=>{
  const saved=await tx.auditReview.create({data:{auditId:id,reviewerId:user.id,reviewerName:user.username,decision:parsed.data.decision,note:parsed.data.note,reportDigest:report?reviewBasisDigest(report):null}});
  await tx.auditEvent.create({data:{auditId:id,actor:user.username,action:parsed.data.decision==="APPROVED"?"REVIEW_APPROVED":"REVIEW_REJECTED",details:{reviewId:saved.id,note:saved.note}}});
  return saved;
 });
 return NextResponse.json({review},{status:201,headers:{"Cache-Control":"no-store"}});
}
