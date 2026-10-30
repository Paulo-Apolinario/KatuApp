CREATE TABLE "ExtraCollectionOrder" (
 "id" TEXT PRIMARY KEY NOT NULL,"cooperativeId" TEXT NOT NULL,"collectorId" TEXT NOT NULL,"contextRouteId" TEXT,"sourceScheduleId" TEXT,"collectionId" TEXT,
 "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',"revision" INTEGER NOT NULL DEFAULT 1,"originalHash" TEXT NOT NULL,"payload" JSONB NOT NULL,"reporterUserId" TEXT NOT NULL,"reporterName" TEXT NOT NULL,"routeNameSnapshot" TEXT,
 "receivedAt" TIMESTAMP(3),"receivedByUserId" TEXT,"custody" TEXT NOT NULL,"custodyNotes" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ExtraCollectionOrder_status_check" CHECK ("status" IN ('PENDING_REVIEW','NEEDS_INFO','ACCEPTED','REJECTED')),
 CONSTRAINT "ExtraCollectionOrder_cooperativeId_fkey" FOREIGN KEY("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExtraCollectionOrder_collectorId_fkey" FOREIGN KEY("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExtraCollectionOrder_contextRouteId_fkey" FOREIGN KEY("contextRouteId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExtraCollectionOrder_sourceScheduleId_fkey" FOREIGN KEY("sourceScheduleId") REFERENCES "Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExtraCollectionOrder_collectionId_fkey" FOREIGN KEY("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExtraCollectionOrder_collectionId_key" ON "ExtraCollectionOrder"("collectionId");
CREATE INDEX "ExtraCollectionOrder_cooperativeId_status_createdAt_idx" ON "ExtraCollectionOrder"("cooperativeId","status","createdAt");
CREATE INDEX "ExtraCollectionOrder_collectorId_createdAt_idx" ON "ExtraCollectionOrder"("collectorId","createdAt");
CREATE INDEX "ExtraCollectionOrder_contextRouteId_idx" ON "ExtraCollectionOrder"("contextRouteId");
CREATE TABLE "ExtraCollectionOrderEvent" ("id" TEXT PRIMARY KEY NOT NULL,"orderId" TEXT NOT NULL,"operationId" TEXT NOT NULL,"operationHash" TEXT NOT NULL,"kind" TEXT NOT NULL,"actorUserId" TEXT NOT NULL,"actorName" TEXT NOT NULL,"notes" TEXT NOT NULL,"data" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ExtraCollectionOrderEvent_orderId_fkey" FOREIGN KEY("orderId") REFERENCES "ExtraCollectionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "ExtraCollectionOrderEvent_orderId_operationId_key" ON "ExtraCollectionOrderEvent"("orderId","operationId");
CREATE INDEX "ExtraCollectionOrderEvent_orderId_createdAt_idx" ON "ExtraCollectionOrderEvent"("orderId","createdAt");
