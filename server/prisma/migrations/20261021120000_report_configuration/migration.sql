CREATE TABLE "ReportConfiguration" (
 "cooperativeId" TEXT NOT NULL,
 "payload" JSONB NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1,
 "updatedBy" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ReportConfiguration_pkey" PRIMARY KEY ("cooperativeId"),
 CONSTRAINT "ReportConfiguration_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
