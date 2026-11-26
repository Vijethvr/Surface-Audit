-- v3.4 methodology workbench and immutable source snapshot
ALTER TABLE "Project" ADD COLUMN "methodologySnapshot" JSONB;
CREATE TABLE "ConsultingMethodology" (
 "id" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "description" TEXT NOT NULL DEFAULT '',
 "revision" TEXT NOT NULL DEFAULT '1.0',
 "blueprint" JSONB NOT NULL,
 "createdBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ConsultingMethodology_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsultingMethodology_title_key" ON "ConsultingMethodology"("title");
