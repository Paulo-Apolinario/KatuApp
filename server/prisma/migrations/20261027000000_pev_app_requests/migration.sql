-- AlterTable
ALTER TABLE "Bin" ADD COLUMN     "publicAccess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PevRequest" (
    "id" TEXT NOT NULL,
    "binId" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "binName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "photos" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "response" TEXT,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PevRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PevRequestUpdate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "photos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PevRequestUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PevRequest_cooperativeId_status_createdAt_idx" ON "PevRequest"("cooperativeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PevRequest_requesterUserId_createdAt_idx" ON "PevRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PevRequest_binId_createdAt_idx" ON "PevRequest"("binId", "createdAt");

-- CreateIndex
CREATE INDEX "PevRequest_collectionId_idx" ON "PevRequest"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PevRequestUpdate_operationId_key" ON "PevRequestUpdate"("operationId");

-- CreateIndex
CREATE INDEX "PevRequestUpdate_requestId_createdAt_idx" ON "PevRequestUpdate"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "PevRequest" ADD CONSTRAINT "PevRequest_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PevRequest" ADD CONSTRAINT "PevRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PevRequest" ADD CONSTRAINT "PevRequest_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PevRequestUpdate" ADD CONSTRAINT "PevRequestUpdate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PevRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

