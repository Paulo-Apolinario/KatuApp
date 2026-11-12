-- AlterTable
ALTER TABLE "MixedBagEvent" ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TriageDay" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriageDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageDayAction" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "operationHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageDayAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TriageDay_cooperativeId_day_key" ON "TriageDay"("cooperativeId", "day");

-- CreateIndex
CREATE INDEX "TriageDayAction_dayId_createdAt_idx" ON "TriageDayAction"("dayId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriageDayAction_cooperativeId_operationId_key" ON "TriageDayAction"("cooperativeId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "MixedBagEvent_reversalOfId_key" ON "MixedBagEvent"("reversalOfId");

-- AddForeignKey
ALTER TABLE "MixedBagEvent" ADD CONSTRAINT "MixedBagEvent_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "MixedBagEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageDay" ADD CONSTRAINT "TriageDay_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageDayAction" ADD CONSTRAINT "TriageDayAction_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "TriageDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE INDEX "MixedBagEvent_cooperativeId_kind_createdAt_idx" ON "MixedBagEvent"("cooperativeId","kind","createdAt");
ALTER TABLE "TriageDay" ADD CONSTRAINT "TriageDay_status_check" CHECK (status IN ('OPEN','CLOSED') AND version >= 0);
