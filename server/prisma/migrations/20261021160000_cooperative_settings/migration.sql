-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AuthEmailToken" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CooperativeSettings" (
    "cooperativeId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "smtp" JSONB,
    "smtpPassword" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CooperativeSettings_pkey" PRIMARY KEY ("cooperativeId")
);

-- CreateTable
CREATE TABLE "SettingEvent" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "fields" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "readAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "assignee" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailDelivery" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "recipients" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "MailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SettingEvent_cooperativeId_createdAt_idx" ON "SettingEvent"("cooperativeId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAlert_cooperativeId_status_updatedAt_idx" ON "SystemAlert"("cooperativeId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemAlert_cooperativeId_key_key" ON "SystemAlert"("cooperativeId", "key");

-- CreateIndex
CREATE INDEX "MailDelivery_cooperativeId_createdAt_idx" ON "MailDelivery"("cooperativeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailDelivery_cooperativeId_dedupeKey_key" ON "MailDelivery"("cooperativeId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "CooperativeSettings" ADD CONSTRAINT "CooperativeSettings_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingEvent" ADD CONSTRAINT "SettingEvent_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAlert" ADD CONSTRAINT "SystemAlert_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailDelivery" ADD CONSTRAINT "MailDelivery_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

