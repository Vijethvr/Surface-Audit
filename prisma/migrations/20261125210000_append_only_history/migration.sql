-- Development audit history is append-only to the application database role.
-- Database owners/superusers may still disable these triggers; this is not WORM storage.
CREATE OR REPLACE FUNCTION "surface_audit_reject_history_mutation"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'SURFACE Audit history is append-only: % on % is forbidden', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "protect_audit_events" BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION "surface_audit_reject_history_mutation"();

CREATE TRIGGER "protect_audit_reviews" BEFORE UPDATE OR DELETE ON "AuditReview"
FOR EACH ROW EXECUTE FUNCTION "surface_audit_reject_history_mutation"();

CREATE TRIGGER "protect_sealed_reports" BEFORE UPDATE OR DELETE ON "AuditReportSnapshot"
FOR EACH ROW EXECUTE FUNCTION "surface_audit_reject_history_mutation"();

CREATE TRIGGER "protect_evidence_assets" BEFORE UPDATE OR DELETE ON "EvidenceAsset"
FOR EACH ROW EXECUTE FUNCTION "surface_audit_reject_history_mutation"();
