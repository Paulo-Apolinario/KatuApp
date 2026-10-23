import type { Prisma } from "@prisma/client";

export async function notifyCollection(
  tx: Prisma.TransactionClient,
  collectionId: string,
  eventKey: string,
  kind: string,
  title: string,
  message: string,
  data?: Prisma.InputJsonValue,
) {
  const collection = await tx.collection.findUniqueOrThrow({
    where: { id: collectionId },
    select: {
      collector: { select: { userId: true } },
      driver: { select: { userId: true } },
      generator: { select: { userId: true } },
      schedule: { select: { requestedByUserId: true } },
    },
  });
  const recipients = [
    ...new Set(
      [
        collection.collector?.userId,
        collection.driver?.userId,
        collection.generator?.userId,
        collection.schedule?.requestedByUserId,
      ].filter((id): id is string => !!id),
    ),
  ];
  if (!recipients.length) return;
  // Não distribuir a usuários sem vínculo, nem depender do e-mail cadastrado.
  const users = await tx.user.findMany({
    where: {
      id: { in: recipients },
      role: {
        in: ["COLLECTOR", "DRIVER", "PF", "GENERATOR_SMALL", "GENERATOR_LARGE"],
      },
    },
    select: { id: true },
  });
  await tx.inboxNotification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      collectionId,
      eventKey,
      kind,
      title,
      message,
      ...(data ? { data } : {}),
    })),
    skipDuplicates: true,
  });
}
