ALTER TABLE "Route" ADD COLUMN "startedAt" TIMESTAMP(3);
CREATE INDEX "Route_cooperativeId_status_startedAt_idx" ON "Route"("cooperativeId", "status", "startedAt");
CREATE INDEX "Route_cooperativeId_planId_scheduledDate_idx" ON "Route"("cooperativeId", "planId", "scheduledDate");
