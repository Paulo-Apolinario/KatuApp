import { prisma } from "../../lib/prisma";

/** Only call after credentials/link validation and session signing, never for /auth/me. */
export async function recordSuccessfulLogin(userId: string, now = new Date()) {
  await prisma.$executeRaw`UPDATE "User" SET
    "firstLoginAt"=CASE WHEN "firstLoginAt" IS NULL THEN ${now} ELSE LEAST("firstLoginAt",${now}) END,
    "lastLoginAt"=CASE WHEN "lastLoginAt" IS NULL THEN ${now} ELSE GREATEST("lastLoginAt",${now}) END
    WHERE id=${userId} AND "credentialsReady" AND "isActive" AND "accountStatus"='ACTIVE'`;
}
