-- Evolução aditiva: preserva identificação, endereço livre, foto e data legada.
ALTER TABLE "Bin"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "pointKind" TEXT NOT NULL DEFAULT 'PEV',
  ADD COLUMN "zipCode" TEXT,
  ADD COLUMN "street" TEXT,
  ADD COLUMN "number" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "state" TEXT,
  ADD COLUMN "regional" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "acceptedMaterials" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "restrictions" TEXT,
  ADD COLUMN "openingHours" JSONB,
  ADD COLUMN "hoursExceptions" TEXT,
  ADD COLUMN "responsibleName" TEXT,
  ADD COLUMN "responsibleContact" TEXT,
  ADD COLUMN "capacityValue" DOUBLE PRECISION,
  ADD COLUMN "capacityUnit" TEXT,
  ADD COLUMN "needsPickup" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pickupReason" TEXT,
  ADD COLUMN "inspectionAt" TIMESTAMP(3);
UPDATE "Bin" SET "needsPickup" = true WHERE "status" = 'FULL';
UPDATE "Bin" SET "status" = 'ACTIVE' WHERE "status" = 'FULL';
UPDATE "Bin" SET "capacityValue" = "capacityKg", "capacityUnit" = 'KG' WHERE "capacityKg" > 0;
ALTER TABLE "Bin" ADD CONSTRAINT "Bin_coordinates_check" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL) OR
  ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
);
ALTER TABLE "Collection" ADD COLUMN "binId" TEXT;
CREATE INDEX "Collection_binId_idx" ON "Collection"("binId");
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "BinEvent" (
  "id" TEXT NOT NULL,
  "binId" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "notes" TEXT,
  "data" JSONB,
  "actorUserId" TEXT NOT NULL,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  CONSTRAINT "BinEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BinEvent_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BinEvent_binId_createdAt_idx" ON "BinEvent"("binId", "createdAt");
CREATE INDEX "BinEvent_cooperativeId_idx" ON "BinEvent"("cooperativeId");
