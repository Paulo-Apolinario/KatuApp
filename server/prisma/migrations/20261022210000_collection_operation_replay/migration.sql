ALTER TABLE "Collection" ADD COLUMN "startOperationId" TEXT, ADD COLUMN "startOperationHash" TEXT, ADD COLUMN "fieldOperationId" TEXT, ADD COLUMN "fieldOperationHash" TEXT;

CREATE TABLE "CollectionWasteDestinationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "destinationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT,
  "operation" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectionWasteDestinationEvent_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "CollectionWasteDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CollectionWasteDestinationEvent_destinationId_createdAt_idx" ON "CollectionWasteDestinationEvent"("destinationId", "createdAt");
