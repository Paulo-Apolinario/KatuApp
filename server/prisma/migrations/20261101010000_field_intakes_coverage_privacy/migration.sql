ALTER TABLE "Collection" ADD COLUMN "intakeKind" TEXT, ADD COLUMN "intakeOrigin" JSONB, ADD COLUMN "intakeOperationId" TEXT, ADD COLUMN "intakeHash" TEXT, ADD COLUMN "intakeWeighOperationId" TEXT, ADD COLUMN "intakeWeighHash" TEXT;
CREATE UNIQUE INDEX "Collection_intakeOperationId_key" ON "Collection"("intakeOperationId");
ALTER TABLE "Route" ADD COLUMN "coverageMode" TEXT NOT NULL DEFAULT 'POINTS', ADD COLUMN "coverageArea" TEXT;
ALTER TABLE "RoutePlan" ADD COLUMN "coverageMode" TEXT NOT NULL DEFAULT 'POINTS', ADD COLUMN "coverageArea" TEXT;
CREATE TABLE "PrivacyAcceptance" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "version" TEXT NOT NULL, "documentHash" TEXT NOT NULL, "document" JSONB NOT NULL, "reportedAcceptedAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PrivacyAcceptance_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "PrivacyAcceptance_userId_version_key" ON "PrivacyAcceptance"("userId", "version");
CREATE INDEX "PrivacyAcceptance_userId_receivedAt_idx" ON "PrivacyAcceptance"("userId", "receivedAt");
