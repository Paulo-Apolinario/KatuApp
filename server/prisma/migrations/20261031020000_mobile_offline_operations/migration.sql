CREATE TABLE "MobileOfflineOperation" (
 "id" TEXT PRIMARY KEY,
 "actorUserId" TEXT NOT NULL,
 "cooperativeId" TEXT NOT NULL,
 "kind" TEXT NOT NULL CHECK (kind IN ('GENERATOR_CREATE','PEV_CREATE')),
 "requestHash" TEXT NOT NULL,
 "entityId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MobileOfflineOperation_cooperativeId_actorUserId_createdAt_idx" ON "MobileOfflineOperation"("cooperativeId","actorUserId","createdAt");
