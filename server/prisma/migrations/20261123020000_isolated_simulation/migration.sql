CREATE TABLE "SimulationWorkspace" (
 "id" TEXT NOT NULL, "cooperativeId" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false,
 "version" INTEGER NOT NULL DEFAULT 1, "state" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SimulationWorkspace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SimulationWorkspace_cooperativeId_key" ON "SimulationWorkspace"("cooperativeId");
ALTER TABLE "SimulationWorkspace" ADD CONSTRAINT "SimulationWorkspace_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "SimulationEvent" (
 "id" TEXT NOT NULL, "workspaceId" TEXT NOT NULL, "operationId" TEXT NOT NULL,
 "operationHash" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "result" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SimulationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SimulationEvent_workspaceId_operationId_key" ON "SimulationEvent"("workspaceId","operationId");
CREATE INDEX "SimulationEvent_workspaceId_createdAt_idx" ON "SimulationEvent"("workspaceId","createdAt");
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "SimulationWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
