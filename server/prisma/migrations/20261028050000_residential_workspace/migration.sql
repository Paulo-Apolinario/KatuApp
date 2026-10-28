ALTER TABLE "PersonProfile" ADD COLUMN "savedAddresses" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Schedule" ADD COLUMN "requestOperationId" TEXT, ADD COLUMN "requestOperationHash" TEXT;
CREATE UNIQUE INDEX "Schedule_requestOperationId_key" ON "Schedule"("requestOperationId");
