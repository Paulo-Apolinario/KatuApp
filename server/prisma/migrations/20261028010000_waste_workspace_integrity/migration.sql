ALTER TABLE "CollectionWasteDestination" ADD COLUMN "operationId" TEXT, ADD COLUMN "operationHash" TEXT, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "lastOperationId" TEXT, ADD COLUMN "lastOperationHash" TEXT;
CREATE UNIQUE INDEX "CollectionWasteDestination_operationId_key" ON "CollectionWasteDestination"("operationId");
CREATE UNIQUE INDEX "CollectionWasteDestination_lastOperationId_key" ON "CollectionWasteDestination"("lastOperationId");
ALTER TABLE "WasteStockItem" ADD COLUMN "normalizedName" TEXT;
-- Preencher apenas nomes inequívocos; duplicados históricos permanecem para revisão humana.
WITH names AS (SELECT id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')) AS normalized, count(*) OVER (PARTITION BY "cooperativeId", lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) AS n FROM "WasteStockItem")
UPDATE "WasteStockItem" i SET "normalizedName"=names.normalized FROM names WHERE names.id=i.id AND names.n=1;
CREATE UNIQUE INDEX "WasteStockItem_cooperativeId_normalizedName_key" ON "WasteStockItem"("cooperativeId", "normalizedName");
CREATE INDEX "Collection_cooperativeId_status_createdAt_idx" ON "Collection"("cooperativeId",status,"createdAt");
CREATE INDEX "CollectionWasteEntry_cooperativeId_status_collectedAt_idx" ON "CollectionWasteEntry"("cooperativeId",status,"collectedAt");
CREATE INDEX "CollectionWasteDestination_cooperativeId_status_destinationDate_idx" ON "CollectionWasteDestination"("cooperativeId",status,"destinationDate");
CREATE INDEX "WasteStockLot_cooperativeId_stockItemId_status_idx" ON "WasteStockLot"("cooperativeId","stockItemId",status);
