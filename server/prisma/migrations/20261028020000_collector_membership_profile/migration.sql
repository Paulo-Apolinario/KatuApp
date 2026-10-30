CREATE TYPE "CollectorCategory" AS ENUM ('FOUNDER', 'EFFECTIVE', 'BENEFICIARY', 'CONTRIBUTOR');
ALTER TABLE "Collector" ADD COLUMN "registrationNumber" TEXT, ADD COLUMN "membershipCategory" "CollectorCategory";
