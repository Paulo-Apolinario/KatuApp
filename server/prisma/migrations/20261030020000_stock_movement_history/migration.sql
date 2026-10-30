-- AlterEnum
ALTER TYPE "WasteLotStatus" ADD VALUE 'DESTINED';

-- AlterTable
ALTER TABLE "WasteStockLot" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "WasteStockMovement" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "operationHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "unit" "WasteUnit" NOT NULL,
    "destinationName" TEXT,
    "destinationDocument" TEXT,
    "destinationAddress" TEXT,
    "transportDocument" TEXT,
    "environmentalDocument" TEXT,
    "notes" TEXT,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WasteStockMovement_lotId_createdAt_id_idx" ON "WasteStockMovement"("lotId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "WasteStockMovement_cooperativeId_movementDate_idx" ON "WasteStockMovement"("cooperativeId", "movementDate");

-- CreateIndex
CREATE UNIQUE INDEX "WasteStockMovement_cooperativeId_operationId_key" ON "WasteStockMovement"("cooperativeId", "operationId");

-- AddForeignKey
ALTER TABLE "WasteStockMovement" ADD CONSTRAINT "WasteStockMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "WasteStockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep movement evidence valid even for writes outside the API.
ALTER TABLE "WasteStockMovement" ADD CONSTRAINT "WasteStockMovement_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 1000000000);
ALTER TABLE "WasteStockMovement" ADD CONSTRAINT "WasteStockMovement_kind_check" CHECK ("kind" IN ('SALE','DONATION','DIRECT_DESTINATION','DISPOSAL','RESERVE','RELEASE','PROCESSING'));
ALTER TABLE "WasteStockMovement" ADD CONSTRAINT "WasteStockMovement_recipient_check" CHECK ("kind" NOT IN ('SALE','DONATION','DIRECT_DESTINATION','DISPOSAL') OR length(trim(coalesce("destinationName",''))) >= 2);
ALTER TABLE "WasteStockLot" ADD CONSTRAINT "WasteStockLot_version_check" CHECK ("version" > 0);
