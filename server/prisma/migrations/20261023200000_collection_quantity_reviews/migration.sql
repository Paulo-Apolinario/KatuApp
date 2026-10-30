ALTER TABLE "Collection" ADD COLUMN "reportedTotalWeightKg" DOUBLE PRECISION, ADD COLUMN "quantityReviewVersion" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "quantitiesReviewedAt" TIMESTAMP(3);
ALTER TABLE "CollectionMaterial" ADD COLUMN "reportedQuantity" DECIMAL(18,3);
UPDATE "CollectionMaterial" SET "reportedQuantity" = "quantity";
CREATE TABLE "CollectionQuantityReview" (
 "id" TEXT NOT NULL PRIMARY KEY, "collectionId" TEXT NOT NULL REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "version" INTEGER NOT NULL, "actorUserId" TEXT NOT NULL, "actorName" TEXT NOT NULL, "reason" TEXT NOT NULL,
 "items" JSONB NOT NULL, "previousTotalKg" DOUBLE PRECISION NOT NULL, "confirmedTotalKg" DOUBLE PRECISION NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CollectionQuantityReview_collectionId_version_key" ON "CollectionQuantityReview"("collectionId","version");
CREATE TABLE "InboxNotification" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "collectionId" TEXT REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "eventKey" TEXT NOT NULL, "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "message" TEXT NOT NULL, "data" JSONB,
 "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InboxNotification_userId_eventKey_key" ON "InboxNotification"("userId","eventKey");
CREATE INDEX "InboxNotification_userId_readAt_createdAt_idx" ON "InboxNotification"("userId","readAt","createdAt");
ALTER TABLE "CollectionMaterial" ADD CONSTRAINT "CollectionMaterial_reportedQuantity_nonnegative" CHECK ("reportedQuantity" IS NULL OR "reportedQuantity" >= 0);
