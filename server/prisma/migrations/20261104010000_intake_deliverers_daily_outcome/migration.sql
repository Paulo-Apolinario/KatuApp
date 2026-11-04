CREATE TABLE "IntakeDeliverer" ("id" TEXT NOT NULL, "cooperativeId" TEXT NOT NULL, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL, "cpf" TEXT, "phone" TEXT, "version" INTEGER NOT NULL DEFAULT 0, "creationHash" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL, "updatedByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "IntakeDeliverer_pkey" PRIMARY KEY("id"));
CREATE UNIQUE INDEX "IntakeDeliverer_cooperativeId_cpf_key" ON "IntakeDeliverer"("cooperativeId", "cpf");
CREATE INDEX "IntakeDeliverer_cooperativeId_normalizedName_id_idx" ON "IntakeDeliverer"("cooperativeId", "normalizedName", "id");
ALTER TABLE "IntakeDeliverer" ADD CONSTRAINT "IntakeDeliverer_cooperativeId_fkey" FOREIGN KEY("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Collection" ADD COLUMN "attendanceOutcome" TEXT, ADD COLUMN "intakeDelivererId" TEXT;
CREATE INDEX "Collection_cooperativeId_intakeDelivererId_createdAt_idx" ON "Collection"("cooperativeId", "intakeDelivererId", "createdAt");
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_intakeDelivererId_fkey" FOREIGN KEY ("intakeDelivererId") REFERENCES "IntakeDeliverer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
