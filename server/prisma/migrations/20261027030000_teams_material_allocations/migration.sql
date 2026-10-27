-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "allocationQuantityVersion" INTEGER,
ADD COLUMN     "allocationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "teamNameSnapshot" TEXT,
ADD COLUMN     "teamVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "teamId" TEXT;

-- AlterTable
ALTER TABLE "RoutePlan" ADD COLUMN     "teamId" TEXT;

-- CreateTable
CREATE TABLE "CollectorTeam" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "memberIds" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionParticipant" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "allocations" JSONB,

    CONSTRAINT "CollectionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionAllocationReview" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "quantityVersion" INTEGER NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionAllocationReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectorTeam_cooperativeId_active_idx" ON "CollectorTeam"("cooperativeId", "active");

-- CreateIndex
CREATE INDEX "CollectionParticipant_collectorId_idx" ON "CollectionParticipant"("collectorId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionParticipant_collectionId_collectorId_key" ON "CollectionParticipant"("collectionId", "collectorId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionAllocationReview_collectionId_version_key" ON "CollectionAllocationReview"("collectionId", "version");

-- AddForeignKey
ALTER TABLE "CollectorTeam" ADD CONSTRAINT "CollectorTeam_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionParticipant" ADD CONSTRAINT "CollectionParticipant_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionParticipant" ADD CONSTRAINT "CollectionParticipant_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "Collector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocationReview" ADD CONSTRAINT "CollectionAllocationReview_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

