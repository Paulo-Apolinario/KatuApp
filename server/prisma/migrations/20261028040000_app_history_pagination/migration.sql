-- Bounded history queries by account, status and deterministic date/id order.
CREATE INDEX "Schedule_requestedByUserId_createdAt_id_idx" ON "Schedule"("requestedByUserId", "createdAt", "id");
CREATE INDEX "Schedule_generatorId_createdAt_id_idx" ON "Schedule"("generatorId", "createdAt", "id");
CREATE INDEX "Collection_cooperativeId_status_createdAt_id_idx" ON "Collection"("cooperativeId", "status", "createdAt", "id");
CREATE INDEX "Collection_driverId_status_createdAt_id_idx" ON "Collection"("driverId", "status", "createdAt", "id");
CREATE INDEX "DriverReport_driverId_createdAt_id_idx" ON "DriverReport"("driverId", "createdAt", "id");
