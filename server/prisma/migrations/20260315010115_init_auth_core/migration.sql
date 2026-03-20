-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PF', 'GENERATOR_SMALL', 'GENERATOR_LARGE', 'COOPERATIVE', 'COLLECTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "GeneratorType" AS ENUM ('SMALL', 'LARGE');

-- CreateEnum
CREATE TYPE "GeneratorAccessStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CollectorStatus" AS ENUM ('AVAILABLE', 'ON_ROUTE', 'INACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cooperative" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cooperative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "address" TEXT,
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "greenStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generator" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "GeneratorType" NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "status" TEXT,
    "accessReleased" BOOLEAN NOT NULL DEFAULT false,
    "accessStatus" "GeneratorAccessStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "Generator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collector" (
    "id" TEXT NOT NULL,
    "cooperativeId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "rg" TEXT,
    "birthDate" TEXT,
    "status" "CollectorStatus" NOT NULL DEFAULT 'AVAILABLE',
    "kgMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectionsToday" INTEGER NOT NULL DEFAULT 0,
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cooperative_registrationNumber_key" ON "Cooperative"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Cooperative_email_key" ON "Cooperative"("email");

-- CreateIndex
CREATE INDEX "Cooperative_name_idx" ON "Cooperative"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_userId_key" ON "PersonProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_cpf_key" ON "PersonProfile"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Generator_userId_key" ON "Generator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Generator_email_key" ON "Generator"("email");

-- CreateIndex
CREATE INDEX "Generator_cooperativeId_idx" ON "Generator"("cooperativeId");

-- CreateIndex
CREATE INDEX "Generator_type_idx" ON "Generator"("type");

-- CreateIndex
CREATE INDEX "Generator_accessStatus_idx" ON "Generator"("accessStatus");

-- CreateIndex
CREATE INDEX "Generator_name_idx" ON "Generator"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Collector_userId_key" ON "Collector"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Collector_email_key" ON "Collector"("email");

-- CreateIndex
CREATE INDEX "Collector_cooperativeId_idx" ON "Collector"("cooperativeId");

-- CreateIndex
CREATE INDEX "Collector_status_idx" ON "Collector"("status");

-- CreateIndex
CREATE INDEX "Collector_name_idx" ON "Collector"("name");

-- AddForeignKey
ALTER TABLE "PersonProfile" ADD CONSTRAINT "PersonProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generator" ADD CONSTRAINT "Generator_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generator" ADD CONSTRAINT "Generator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collector" ADD CONSTRAINT "Collector_cooperativeId_fkey" FOREIGN KEY ("cooperativeId") REFERENCES "Cooperative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collector" ADD CONSTRAINT "Collector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
