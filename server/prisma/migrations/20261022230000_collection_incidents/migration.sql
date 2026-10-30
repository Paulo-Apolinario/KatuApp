CREATE TABLE "CollectionIncident" (
 "id" TEXT PRIMARY KEY NOT NULL, "collectionId" TEXT NOT NULL, "cooperativeId" TEXT NOT NULL, "reportedByUserId" TEXT NOT NULL,
 "reportedByName" TEXT, "operationId" TEXT, "description" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "resolution" TEXT,
 "resolvedByUserId" TEXT, "resolvedByName" TEXT, "resolvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CollectionIncident_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CollectionIncident_collectionId_reportedByUserId_operationId_key" ON "CollectionIncident"("collectionId", "reportedByUserId", "operationId");
CREATE INDEX "CollectionIncident_cooperativeId_status_createdAt_idx" ON "CollectionIncident"("cooperativeId", "status", "createdAt");

ALTER TABLE "Schedule" ADD COLUMN "pickupAddress" TEXT, ADD COLUMN "pickupLatitude" DOUBLE PRECISION, ADD COLUMN "pickupLongitude" DOUBLE PRECISION;
