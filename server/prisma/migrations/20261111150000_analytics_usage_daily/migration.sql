CREATE TABLE "AnalyticsUsageDaily" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cooperativeId" TEXT,
  "day" VARCHAR(10) NOT NULL,
  "seconds" INTEGER NOT NULL DEFAULT 0,
  "lastSlot" TIMESTAMP(3) NOT NULL,
  "lastSlotSeconds" INTEGER NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "webUsed" BOOLEAN NOT NULL DEFAULT false,
  "appUsed" BOOLEAN NOT NULL DEFAULT false,
  "roleSnapshot" TEXT NOT NULL,
  CONSTRAINT "AnalyticsUsageDaily_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AnalyticsUsageDaily_seconds_check" CHECK ("seconds" BETWEEN 0 AND 86400 AND "lastSlotSeconds" BETWEEN 0 AND 30)
);
CREATE UNIQUE INDEX "AnalyticsUsageDaily_userId_day_key" ON "AnalyticsUsageDaily"("userId","day");
CREATE INDEX "AnalyticsUsageDaily_cooperativeId_day_idx" ON "AnalyticsUsageDaily"("cooperativeId","day");
ALTER TABLE "AnalyticsUsageDaily" ADD CONSTRAINT "AnalyticsUsageDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsUsageDaily" ADD CONSTRAINT "AnalyticsUsageDaily_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
