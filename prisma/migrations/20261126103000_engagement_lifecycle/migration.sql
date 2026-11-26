-- v3.2: project-scoped consulting engagement lifecycle and append-only change log.
CREATE TABLE "EngagementLifecycle" (
 "id" TEXT NOT NULL,
 "projectId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 0,
 "objective" TEXT NOT NULL DEFAULT '',
 "scope" TEXT NOT NULL DEFAULT '',
 "exclusions" TEXT NOT NULL DEFAULT '',
 "commercialNote" TEXT NOT NULL DEFAULT '',
 "stage" TEXT NOT NULL DEFAULT 'PROPOSED',
 "milestones" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "deliverables" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "EngagementLifecycle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EngagementLifecycle_projectId_key" ON "EngagementLifecycle"("projectId");
ALTER TABLE "EngagementLifecycle" ADD CONSTRAINT "EngagementLifecycle_projectId_fkey"
 FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EngagementLifecycleEvent" (
 "id" TEXT NOT NULL,
 "lifecycleId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL,
 "actor" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "summary" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EngagementLifecycleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EngagementLifecycleEvent_lifecycleId_createdAt_idx"
 ON "EngagementLifecycleEvent"("lifecycleId","createdAt");
ALTER TABLE "EngagementLifecycleEvent" ADD CONSTRAINT "EngagementLifecycleEvent_lifecycleId_fkey"
 FOREIGN KEY ("lifecycleId") REFERENCES "EngagementLifecycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER "protect_engagement_lifecycle_history"
 BEFORE UPDATE OR DELETE ON "EngagementLifecycleEvent"
 FOR EACH ROW EXECUTE FUNCTION "surface_audit_reject_history_mutation"();
