CREATE TABLE "SaleNotePreparation" (
 "id" TEXT NOT NULL, "cooperativeId" TEXT NOT NULL, "sourceKey" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "unitPrice" DECIMAL(18,4) NOT NULL,
 "total" DECIMAL(24,2) NOT NULL, "notes" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 "updatedBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SaleNotePreparation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SaleNotePreparation_cooperativeId_sourceKey_key" ON "SaleNotePreparation"("cooperativeId","sourceKey");
ALTER TABLE "SaleNotePreparation" ADD CONSTRAINT "SaleNotePreparation_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "SaleNoteRevision" (
 "id" TEXT NOT NULL, "preparationId" TEXT NOT NULL, "operationId" TEXT NOT NULL,
 "operationHash" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SaleNoteRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SaleNoteRevision_preparationId_operationId_key" ON "SaleNoteRevision"("preparationId","operationId");
CREATE INDEX "SaleNoteRevision_preparationId_createdAt_idx" ON "SaleNoteRevision"("preparationId","createdAt");
ALTER TABLE "SaleNoteRevision" ADD CONSTRAINT "SaleNoteRevision_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "SaleNotePreparation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
