-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "routePoint" JSONB,
ADD COLUMN     "routePointKey" TEXT;

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "collectorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "departureTime" TEXT,
ADD COLUMN     "endPoint" JSONB,
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "executionDate" TEXT,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startPoint" JSONB;

-- CreateTable
CREATE TABLE "RoutePlan" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "startsOn" TEXT NOT NULL,
    "endsOn" TEXT,
    "weekdays" INTEGER[],
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "departureTime" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 240,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "collectorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "points" JSONB NOT NULL,
    "startPoint" JSONB NOT NULL,
    "endPoint" JSONB NOT NULL,
    "exceptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastGenerationError" TEXT,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutePlan_cooperativeId_active_idx" ON "RoutePlan"("cooperativeId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Route_planId_executionDate_key" ON "Route"("planId", "executionDate");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RoutePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutePlan" ADD CONSTRAINT "RoutePlan_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

