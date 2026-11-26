-- v3.7 procedure conversation: immutable, audit-linked sequence of observations.
CREATE TABLE "ProcedureDialogue" (
 "id" TEXT NOT NULL,
 "auditId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ProcedureDialogue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcedureDialogue_auditId_key" ON "ProcedureDialogue"("auditId");
ALTER TABLE "ProcedureDialogue" ADD CONSTRAINT "ProcedureDialogue_auditId_fkey"
 FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProcedureDialogueTurn" (
 "id" TEXT NOT NULL,
 "dialogueId" TEXT NOT NULL,
 "sequence" INTEGER NOT NULL,
 "kind" TEXT NOT NULL,
 "text" TEXT NOT NULL,
 "requirementCode" TEXT,
 "author" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ProcedureDialogueTurn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcedureDialogueTurn_dialogueId_sequence_key" ON "ProcedureDialogueTurn"("dialogueId","sequence");
CREATE INDEX "ProcedureDialogueTurn_dialogueId_createdAt_idx" ON "ProcedureDialogueTurn"("dialogueId","createdAt");
ALTER TABLE "ProcedureDialogueTurn" ADD CONSTRAINT "ProcedureDialogueTurn_dialogueId_fkey"
 FOREIGN KEY ("dialogueId") REFERENCES "ProcedureDialogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER "protect_procedure_dialogue_turn_history"
 BEFORE UPDATE OR DELETE ON "ProcedureDialogueTurn"
 FOR EACH ROW EXECUTE FUNCTION "surface_audit_reject_history_mutation"();
