import type { Prisma } from "@prisma/client";
export async function recoveryContactChanged(
  tx: Prisma.TransactionClient,
  data: {
    cooperativeId: string;
    actorUserId: string;
    recordKind: string;
    recordId: string;
    userId?: string | null;
    before?: string | null;
    after?: string | null;
  },
) {
  if ((data.before || null) === (data.after || null)) return;
  if (data.userId)
    await tx.authEmailToken.updateMany({
      where: { userId: data.userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  await tx.registrationAccessEvent.create({
    data: {
      cooperativeId: data.cooperativeId,
      actorUserId: data.actorUserId,
      recordKind: data.recordKind,
      recordId: data.recordId,
      action: "RECOVERY_CONTACT_CHANGED",
    },
  });
}
