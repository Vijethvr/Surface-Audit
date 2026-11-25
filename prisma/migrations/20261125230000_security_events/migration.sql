-- v1.9 local security-event register.
CREATE TABLE "SecurityEvent" (
 "id" TEXT NOT NULL,
 "eventType" TEXT NOT NULL,
 "outcome" TEXT NOT NULL,
 "actorUsername" TEXT,
 "subjectUsername" TEXT,
 "details" JSONB NOT NULL DEFAULT '{}',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");
CREATE INDEX "SecurityEvent_eventType_createdAt_idx" ON "SecurityEvent"("eventType","createdAt");

-- Ordinary application-level SQL may append but cannot alter existing security events.
CREATE TRIGGER "protect_security_events" BEFORE UPDATE OR DELETE ON "SecurityEvent"
FOR EACH ROW EXECUTE FUNCTION "surface_audit_reject_history_mutation"();
