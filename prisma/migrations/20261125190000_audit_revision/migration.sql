-- v1.4 audit optimistic concurrency / row-level mutation coordination.
-- Safe additive migration for databases already on the v1.3 versioned baseline.
ALTER TABLE "Audit" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
