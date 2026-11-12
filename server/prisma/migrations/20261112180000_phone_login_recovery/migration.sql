ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "credentialsReady" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Generator" ADD COLUMN "recoveryEmail" TEXT;
ALTER TABLE "Collector" ADD COLUMN "recoveryEmail" TEXT;
CREATE TABLE "RegistrationAccessEvent" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "recordKind" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationAccessEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RegistrationAccessEvent_cooperativeId_createdAt_idx" ON "RegistrationAccessEvent"("cooperativeId", "createdAt");
