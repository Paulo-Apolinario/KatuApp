-- CreateEnum
CREATE TYPE "AgentKey" AS ENUM ('COLLECTIONS', 'ROUTES', 'MANAGER');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentOrigin" AS ENUM ('MANUAL', 'COMMAND', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "AgentProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "agent" "AgentKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "actorId" TEXT,
    "conversationId" TEXT,
    "agent" "AgentKey" NOT NULL,
    "command" TEXT NOT NULL,
    "origin" "AgentOrigin" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "result" JSONB,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProposal" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "AgentProposalStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AgentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAuditEvent" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentConfig_enabled_nextRunAt_idx" ON "AgentConfig"("enabled", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_cooperativeId_agent_key" ON "AgentConfig"("cooperativeId", "agent");

-- CreateIndex
CREATE INDEX "AgentConversation_cooperativeId_createdAt_id_idx" ON "AgentConversation"("cooperativeId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConversation_cooperativeId_id_key" ON "AgentConversation"("cooperativeId", "id");

-- CreateIndex
CREATE INDEX "AgentRun_cooperativeId_startedAt_id_idx" ON "AgentRun"("cooperativeId", "startedAt", "id");

-- CreateIndex
CREATE INDEX "AgentRun_cooperativeId_status_expiresAt_idx" ON "AgentRun"("cooperativeId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_expiresAt_idx" ON "AgentRun"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_cooperativeId_eventKey_key" ON "AgentRun"("cooperativeId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_cooperativeId_id_key" ON "AgentRun"("cooperativeId", "id");

-- CreateIndex
CREATE INDEX "AgentMessage_cooperativeId_conversationId_createdAt_id_idx" ON "AgentMessage"("cooperativeId", "conversationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMessage_runId_role_key" ON "AgentMessage"("runId", "role");

-- CreateIndex
CREATE INDEX "AgentProposal_cooperativeId_status_createdAt_id_idx" ON "AgentProposal"("cooperativeId", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProposal_cooperativeId_fingerprint_key" ON "AgentProposal"("cooperativeId", "fingerprint");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_cooperativeId_createdAt_id_idx" ON "AgentAuditEvent"("cooperativeId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAuditEvent_cooperativeId_eventKey_key" ON "AgentAuditEvent"("cooperativeId", "eventKey");

-- AddForeignKey
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversation" ADD CONSTRAINT "AgentConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_cooperativeId_conversationId_fkey" FOREIGN KEY ("cooperativeId", "conversationId") REFERENCES "AgentConversation"("cooperativeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_cooperativeId_conversationId_fkey" FOREIGN KEY ("cooperativeId", "conversationId") REFERENCES "AgentConversation"("cooperativeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_cooperativeId_runId_fkey" FOREIGN KEY ("cooperativeId", "runId") REFERENCES "AgentRun"("cooperativeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_cooperativeId_runId_fkey" FOREIGN KEY ("cooperativeId", "runId") REFERENCES "AgentRun"("cooperativeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditEvent" ADD CONSTRAINT "AgentAuditEvent_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAuditEvent" ADD CONSTRAINT "AgentAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
