ALTER TABLE "Route" ADD COLUMN "operationalEvents" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "closureOutcome" TEXT,
ADD COLUMN "closedAt" TIMESTAMP(3);
