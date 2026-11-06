ALTER TABLE "WasteStockItem" ADD COLUMN "technicalProfile" JSONB;
ALTER TABLE "CollectionMaterial" ADD COLUMN "identificationSnapshot" JSONB;
CREATE TABLE "ReportConfigurationRevision" (
  "cooperativeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportConfigurationRevision_pkey" PRIMARY KEY ("cooperativeId", "version"),
  CONSTRAINT "ReportConfigurationRevision_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "ReportConfigurationRevision" ("cooperativeId", "version", "payload", "updatedBy", "createdAt")
SELECT "cooperativeId", "version", "payload", "updatedBy", "updatedAt" FROM "ReportConfiguration";
