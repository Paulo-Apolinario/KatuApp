-- Historical activation/login dates are unknown: never infer them from createdAt or activity.
ALTER TABLE "User" ADD COLUMN "accessEnabledAt" TIMESTAMP(3),
                   ADD COLUMN "firstLoginAt" TIMESTAMP(3),
                   ADD COLUMN "lastLoginAt" TIMESTAMP(3);
