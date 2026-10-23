-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MUNICIPAL_MANAGER';

-- CreateTable
CREATE TABLE "EnvironmentalUnit" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT,
    "municipalityCode" TEXT NOT NULL,
    "authorityKey" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "officialUnitCode" TEXT,
    "address" TEXT,
    "responsibleName" TEXT,
    "responsiblePosition" TEXT,
    "appointmentReference" TEXT,
    "operationalRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environment" TEXT NOT NULL DEFAULT 'HOMOLOGATION',
    "shareWithMunicipality" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalMunicipalAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "municipalityCode" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "appointmentReference" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalMunicipalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalDocument" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "referenceYear" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "sourceCollectionId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedUnitVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalAttachment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalUnit_authorityKey_key" ON "EnvironmentalUnit"("authorityKey");

-- CreateIndex
CREATE INDEX "EnvironmentalUnit_cooperativeId_municipalityCode_idx" ON "EnvironmentalUnit"("cooperativeId", "municipalityCode");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalMunicipalAccess_userId_municipalityCode_key" ON "EnvironmentalMunicipalAccess"("userId", "municipalityCode");

-- CreateIndex
CREATE INDEX "EnvironmentalDocument_unitId_family_updatedAt_idx" ON "EnvironmentalDocument"("unitId", "family", "updatedAt");

-- CreateIndex
CREATE INDEX "EnvironmentalEvent_documentId_createdAt_idx" ON "EnvironmentalEvent"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalAttachment_storageKey_key" ON "EnvironmentalAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "EnvironmentalAttachment_documentId_idx" ON "EnvironmentalAttachment"("documentId");

-- AddForeignKey
ALTER TABLE "EnvironmentalDocument" ADD CONSTRAINT "EnvironmentalDocument_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "EnvironmentalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalEvent" ADD CONSTRAINT "EnvironmentalEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EnvironmentalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalAttachment" ADD CONSTRAINT "EnvironmentalAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EnvironmentalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

