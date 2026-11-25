import {prisma} from "@/lib/db";

// Only allow fixed event categories. Never log credentials, tokens, request bodies,
// IP addresses, evidence contents or password material.
export const securityEventTypes=[
 "LOGIN_FAILED","LOGIN_LOCKED","LOGIN_SUCCEEDED","LOGOUT",
 "OPERATOR_DISABLED","OPERATOR_ENABLED","LOGIN_LOCKOUT_RESET",
 "REVIEW_APPROVED","REVIEW_REJECTED"
] as const;
export type SecurityEventType=(typeof securityEventTypes)[number];

export async function recordSecurityEvent(input:{
 eventType:SecurityEventType;
 outcome:"SUCCESS"|"DENIED";
 actorUsername?:string|null;
 subjectUsername?:string|null;
}){
 await prisma.securityEvent.create({data:{
  eventType:input.eventType,outcome:input.outcome,
  actorUsername:input.actorUsername??null,subjectUsername:input.subjectUsername??null
 }});
}
