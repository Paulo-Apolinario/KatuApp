CREATE TABLE "OwnerDocument" (
 "id" TEXT NOT NULL PRIMARY KEY, "cooperativeId" TEXT NOT NULL,
 "generatorId" TEXT, "collectorId" TEXT, "driverId" TEXT, "vehicleId" TEXT,
 "title" TEXT NOT NULL, "documentType" TEXT NOT NULL, "documentNumber" TEXT,
 "issueDate" TIMESTAMP(3), "expiryDate" TIMESTAMP(3), "notes" TEXT,
 "originalName" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "size" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OwnerDocument_one_owner" CHECK (num_nonnulls("generatorId","collectorId","driverId","vehicleId")=1),
 CONSTRAINT "OwnerDocument_positive_size" CHECK ("size">0 AND "size"<=10485760),
 FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("generatorId") REFERENCES "Generator"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OwnerDocument_storageKey_key" ON "OwnerDocument"("storageKey");
CREATE INDEX "OwnerDocument_cooperativeId_generatorId_idx" ON "OwnerDocument"("cooperativeId","generatorId");
CREATE INDEX "OwnerDocument_cooperativeId_collectorId_idx" ON "OwnerDocument"("cooperativeId","collectorId");
CREATE INDEX "OwnerDocument_cooperativeId_driverId_idx" ON "OwnerDocument"("cooperativeId","driverId");
CREATE INDEX "OwnerDocument_cooperativeId_vehicleId_idx" ON "OwnerDocument"("cooperativeId","vehicleId");
