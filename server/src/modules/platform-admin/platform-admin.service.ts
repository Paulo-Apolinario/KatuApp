import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../utils/hash";

/** Explicit operator-only bootstrap. Never exposed as an HTTP endpoint or run on deploy. */
export async function provisionPlatformAdministrator(email: string, password: string, displayName: string) {
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${"platform-admin:" + email}))`;
    const existing = await tx.user.findUnique({ where: { email }, include: { cooperative: true, collector: true, driver: true, generator: true, personProfile: true } });
    if (existing && (existing.role !== "ADMIN" || existing.cooperative || existing.collector || existing.driver || existing.generator || existing.personProfile)) {
      throw Error("Este e-mail já possui outro perfil ou vínculo operacional. Nenhuma conta foi alterada. Use um e-mail administrativo separado.");
    }
    const select = { id: true, email: true, displayName: true, role: true, isActive: true, credentialsReady: true } as const;
    if (!existing) return tx.user.create({ data: { email, displayName, passwordHash, role: "ADMIN", isActive: true, accountStatus: "ACTIVE", credentialsReady: true, accessEnabledAt: new Date() }, select });
    await tx.authEmailToken.updateMany({ where: { userId: existing.id, consumedAt: null }, data: { consumedAt: new Date() } });
    return tx.user.update({ where: { id: existing.id }, data: { displayName, passwordHash, role: "ADMIN", isActive: true, accountStatus: "ACTIVE", credentialsReady: true, accessEnabledAt: existing.accessEnabledAt || new Date(), authVersion: { increment: 1 }, resetPasswordToken: null, resetPasswordExpiresAt: null }, select });
  });
}
