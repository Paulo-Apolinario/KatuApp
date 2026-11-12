-- CreateTable
CREATE TABLE "MixedBag" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "externalTag" TEXT,
    "grossKg" DECIMAL(18,3) NOT NULL,
    "tareKg" DECIMAL(18,3) NOT NULL,
    "netKg" DECIMAL(18,3) NOT NULL,
    "sortedKg" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "rejectedKg" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "originLabel" TEXT NOT NULL,
    "originSnapshot" JSONB NOT NULL,
    "storageLocation" TEXT,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MixedBag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MixedBagEvent" (
    "id" TEXT NOT NULL,
    "bagId" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "operationHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "participantSnapshot" JSONB NOT NULL,
    "rejectedKg" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MixedBagEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MixedBagOutput" (
    "id" TEXT NOT NULL,
    "bagId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "quantityKg" DECIMAL(18,3) NOT NULL,
    "lotCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MixedBagOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MixedBag_cooperativeId_externalTag_status_idx" ON "MixedBag"("cooperativeId", "externalTag", "status");

-- CreateIndex
CREATE INDEX "MixedBag_collectionId_idx" ON "MixedBag"("collectionId");

-- CreateIndex
CREATE INDEX "MixedBag_cooperativeId_status_receivedAt_idx" ON "MixedBag"("cooperativeId", "status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MixedBag_cooperativeId_code_key" ON "MixedBag"("cooperativeId", "code");

-- CreateIndex
CREATE INDEX "MixedBagEvent_bagId_createdAt_idx" ON "MixedBagEvent"("bagId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MixedBagEvent_cooperativeId_operationId_key" ON "MixedBagEvent"("cooperativeId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "MixedBagOutput_materialId_key" ON "MixedBagOutput"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "MixedBagOutput_destinationId_key" ON "MixedBagOutput"("destinationId");

-- CreateIndex
CREATE INDEX "MixedBagOutput_lotId_createdAt_idx" ON "MixedBagOutput"("lotId", "createdAt");

-- AddForeignKey
ALTER TABLE "MixedBag" ADD CONSTRAINT "MixedBag_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixedBag" ADD CONSTRAINT "MixedBag_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixedBagEvent" ADD CONSTRAINT "MixedBagEvent_bagId_fkey" FOREIGN KEY ("bagId") REFERENCES "MixedBag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixedBagOutput" ADD CONSTRAINT "MixedBagOutput_bagId_fkey" FOREIGN KEY ("bagId") REFERENCES "MixedBag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixedBagOutput" ADD CONSTRAINT "MixedBagOutput_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MixedBagEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixedBagOutput" ADD CONSTRAINT "MixedBagOutput_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "WasteStockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixedBagOutput" ADD CONSTRAINT "MixedBagOutput_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "CollectionMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MixedBagOutput" ADD CONSTRAINT "MixedBagOutput_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "CollectionWasteDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep physical mass conservation valid even outside the API.
ALTER TABLE "MixedBag" ADD CONSTRAINT "MixedBag_mass_check" CHECK (
  "grossKg" > "tareKg" AND "tareKg" >= 0
  AND "netKg" = "grossKg" - "tareKg"
  AND "sortedKg" >= 0 AND "rejectedKg" >= 0
  AND "sortedKg" + "rejectedKg" <= "netKg"
);
ALTER TABLE "MixedBagOutput" ADD CONSTRAINT "MixedBagOutput_positive_check" CHECK ("quantityKg" > 0);
