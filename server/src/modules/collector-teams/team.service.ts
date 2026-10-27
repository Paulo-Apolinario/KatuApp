import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { notifyCollection } from "../inbox/inbox.service";
import { allocationSnapshot, creditedKg, executed } from "./team.model";
export class TeamError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
export const teamSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    active: z.boolean(),
    memberIds: z
      .array(z.string().min(1))
      .min(2)
      .max(30)
      .refine((a) => new Set(a).size === a.length, "Não repita participantes."),
    expectedVersion: z.number().int().min(0).optional(),
  })
  .strict();
const decimal = z
  .number()
  .finite()
  .min(0)
  .max(1e9)
  .refine(
    (n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.00001,
    "Use até três casas decimais.",
  );
export const allocationSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    quantityVersion: z.number().int().min(0),
    reason: z.string().trim().min(5).max(1000),
    items: z
      .array(
        z
          .object({
            materialId: z.string().min(1),
            collectorId: z.string().min(1),
            quantity: decimal,
          })
          .strict(),
      )
      .min(1)
      .max(3000),
  })
  .strict();
export async function teamScope(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { cooperative: true },
  });
  if (
    u?.role !== "COOPERATIVE" ||
    !u.isActive ||
    u.accountStatus !== "ACTIVE" ||
    !u.cooperative
  )
    throw new TeamError("Acesso exclusivo à cooperativa responsável.", 403);
  return u.cooperative.id;
}
export async function teamMembers(
  tx: Prisma.TransactionClient,
  coopId: string,
  id: string,
  expectedIds?: string[],
) {
  const team = await tx.collectorTeam.findFirst({
    where: { id, cooperativeId: coopId, active: true },
  });
  if (!team) throw new TeamError("Equipe não encontrada ou inativa.", 404);
  if (
    expectedIds &&
    (expectedIds.length !== team.memberIds.length ||
      expectedIds.some((i) => !team.memberIds.includes(i)))
  )
    throw new TeamError(
      "Os catadores devem coincidir com a equipe selecionada. Recarregue a equipe.",
      409,
    );
  const people = await tx.collector.findMany({
    where: {
      id: { in: team.memberIds },
      cooperativeId: coopId,
      status: { not: "INACTIVE" },
      user: { isActive: true, accountStatus: "ACTIVE" },
    },
    select: { id: true, name: true },
  });
  if (people.length !== team.memberIds.length)
    throw new TeamError(
      "A equipe possui catador sem vínculo ativo. Revise seus participantes.",
      409,
    );
  return { team, people };
}
export async function snapshotCollectionTeam(
  tx: Prisma.TransactionClient,
  collectionId: string,
  coopId: string,
  teamId: string | null,
  expectedIds?: string[],
) {
  const c = await tx.collection.findFirstOrThrow({
    where: { id: collectionId, cooperativeId: coopId },
    include: { participants: true },
  });
  if (c.status !== "PENDING") {
    if (
      c.teamId !== teamId ||
      (teamId &&
        expectedIds &&
        JSON.stringify(c.participants.map((p) => p.collectorId).sort()) !==
          JSON.stringify([...expectedIds].sort()))
    )
      throw new TeamError(
        "Não altere a equipe de uma coleta já iniciada.",
        409,
      );
    return;
  }
  // Um roteiro nunca deve transferir silenciosamente material ou histórico entre equipes.
  const currentIds = c.participants.map((p) => p.collectorId).sort();
  if (
    teamId &&
    c.teamId === teamId &&
    currentIds.length >= 2 &&
    (!expectedIds ||
      JSON.stringify([...expectedIds].sort()) === JSON.stringify(currentIds))
  )
    return;
  const { team, people } = teamId
    ? await teamMembers(tx, coopId, teamId, expectedIds)
    : { team: null, people: [] };
  if (
    c.teamId === teamId &&
    JSON.stringify(currentIds) ===
      JSON.stringify(people.map((p) => p.id).sort())
  )
    return;
  if (c.collectorId && team && !team.memberIds.includes(c.collectorId))
    throw new TeamError(
      "O responsável da coleta precisa pertencer à equipe selecionada.",
      409,
    );
  await tx.collectionParticipant.deleteMany({ where: { collectionId } });
  if (people.length)
    await tx.collectionParticipant.createMany({
      data: people.map((p) => ({
        collectionId,
        collectorId: p.id,
        nameSnapshot: p.name,
      })),
    });
  await tx.collection.update({
    where: { id: collectionId },
    data: {
      teamId,
      collectorId: c.collectorId || people[0]?.id || null,
      teamNameSnapshot: team?.name || null,
      teamVersion: { increment: 1 },
    },
  });
}
export async function snapshotRouteTeam(
  tx: Prisma.TransactionClient,
  routeId: string,
) {
  const route = await tx.route.findUniqueOrThrow({ where: { id: routeId } });
  const rows = await tx.collection.findMany({
    where: { routeId, status: { not: "CANCELLED" } },
    select: { id: true, collectorId: true, status: true },
  });
  for (const c of rows) {
    if (
      c.status === "PENDING" &&
      route.teamId &&
      !route.collectorIds.includes(c.collectorId || "")
    )
      await tx.collection.update({
        where: { id: c.id },
        data: { collectorId: route.collectorIds[0] },
      });
    await snapshotCollectionTeam(
      tx,
      c.id,
      route.cooperativeId,
      route.teamId,
      route.collectorIds,
    );
  }
}
export async function refreshTeamTotals(
  tx: Prisma.TransactionClient,
  ids: string[],
) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  // Ordem estável evita inversão de locks quando duas entregas envolvem os mesmos catadores.
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT id FROM "Collector" WHERE id=${id} FOR UPDATE`;
    const collector = await tx.collector.findUniqueOrThrow({ where: { id } });
    const rows = await tx.collection.findMany({
      where: {
        cooperativeId: collector.cooperativeId!,
        OR: [
          { collectorId: id },
          { participants: { some: { collectorId: id } } },
        ],
      },
      include: { participants: true },
    });
    const local = (d: Date | null) =>
      d ? new Date(d.getTime() - 10800000).toISOString().slice(0, 10) : "";
    await tx.collector.update({
      where: { id },
      data: {
        totalKg: rows.reduce((s, c) => s + creditedKg(c, id), 0),
        kgMonth: rows
          .filter((c) => local(c.collectedAt).slice(0, 7) === day.slice(0, 7))
          .reduce((s, c) => s + creditedKg(c, id), 0),
        collectionsToday: rows.filter(
          (c) => executed.has(c.status) && local(c.collectedAt) === day,
        ).length,
        status:
          collector.status === "INACTIVE"
            ? "INACTIVE"
            : rows.some((c) => c.status === "IN_PROGRESS")
              ? "ON_ROUTE"
              : "AVAILABLE",
      },
    });
  }
}
export const teamService = {
  async list(coopId: string) {
    return prisma.collectorTeam.findMany({
      where: { cooperativeId: coopId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  },
  async save(coopId: string, input: z.infer<typeof teamSchema>, id?: string) {
    return prisma.$transaction(async (tx) => {
      if (id)
        await tx.$queryRaw`SELECT id FROM "CollectorTeam" WHERE id=${id} FOR UPDATE`;
      const old = id
        ? await tx.collectorTeam.findFirst({
            where: { id, cooperativeId: coopId },
          })
        : null;
      if (id && !old) throw new TeamError("Equipe não encontrada.", 404);
      if (old && old.version !== input.expectedVersion)
        throw new TeamError("Equipe alterada. Atualize antes de salvar.", 409);
      const count = await tx.collector.count({
        where: {
          id: { in: input.memberIds },
          cooperativeId: coopId,
          status: { not: "INACTIVE" },
          user: { isActive: true, accountStatus: "ACTIVE" },
        },
      });
      if (input.active && count !== input.memberIds.length)
        throw new TeamError(
          "Selecione apenas catadores ativos desta cooperativa.",
        );
      // Mesmo equipes inativas não podem referenciar pessoas de outra cooperativa.
      if (
        (await tx.collector.count({
          where: { id: { in: input.memberIds }, cooperativeId: coopId },
        })) !== input.memberIds.length
      )
        throw new TeamError("Participante fora da cooperativa.", 403);
      const data = {
        name: input.name,
        active: input.active,
        memberIds: input.memberIds,
      };
      return old
        ? tx.collectorTeam.update({
            where: { id },
            data: { ...data, version: { increment: 1 } },
          })
        : tx.collectorTeam.create({ data: { ...data, cooperativeId: coopId } });
    });
  },
  async assign(
    coopId: string,
    collectionId: string,
    teamId: string | null,
    expectedVersion: number,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${collectionId} FOR UPDATE`;
      const c = await tx.collection.findFirst({
        where: { id: collectionId, cooperativeId: coopId },
      });
      if (!c) throw new TeamError("Coleta não encontrada.", 404);
      if (c.status !== "PENDING" || c.routeId)
        throw new TeamError(
          "Defina a equipe antes de iniciar. Em rotas, utilize a edição do roteiro.",
          409,
        );
      if (c.teamVersion !== expectedVersion)
        throw new TeamError(
          "Equipe da coleta alterada. Atualize os detalhes.",
          409,
        );
      await snapshotCollectionTeam(tx, c.id, coopId, teamId);
      await notifyCollection(
        tx,
        c.id,
        `team:${c.id}:${c.teamVersion + 1}`,
        "COLLECTION_TEAM",
        "Equipe da coleta atualizada",
        "Confira os participantes da coleta no aplicativo.",
      );
    });
  },
  async allocate(
    coopId: string,
    userId: string,
    collectionId: string,
    data: z.infer<typeof allocationSchema>,
  ) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${collectionId} FOR UPDATE`;
        const c = await tx.collection.findFirst({
          where: { id: collectionId, cooperativeId: coopId },
          include: { participants: true, collectionMaterials: true },
        });
        if (!c) throw new TeamError("Coleta não encontrada.", 404);
        if (
          !["RECEIVED", "SORTING"].includes(c.status) ||
          !c.quantitiesReviewedAt
        )
          throw new TeamError(
            "Receba a coleta e confirme a pesagem antes de dividir os materiais.",
            409,
          );
        if (c.participants.length < 2)
          throw new TeamError("Esta coleta não possui equipe registrada.", 409);
        if (
          data.expectedVersion !== c.allocationVersion ||
          data.quantityVersion !== c.quantityReviewVersion
        )
          throw new TeamError(
            "A divisão ou a pesagem mudou. Atualize antes de salvar.",
            409,
          );
        let snapshot;
        try {
          snapshot = allocationSnapshot(
            c.collectionMaterials,
            c.participants,
            data.items,
          );
        } catch (e: any) {
          throw new TeamError(e.message);
        }
        for (const p of snapshot)
          await tx.collectionParticipant.update({
            where: {
              collectionId_collectorId: {
                collectionId,
                collectorId: p.collectorId,
              },
            },
            data: { allocations: p.materials },
          });
        const actor = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { displayName: true },
        });
        const version = c.allocationVersion + 1;
        await tx.collection.update({
          where: { id: collectionId },
          data: {
            allocationVersion: version,
            allocationQuantityVersion: c.quantityReviewVersion,
          },
        });
        await tx.collectionAllocationReview.create({
          data: {
            collectionId,
            version,
            quantityVersion: c.quantityReviewVersion,
            actorUserId: userId,
            actorName: actor.displayName,
            reason: data.reason,
            snapshot,
          },
        });
        await refreshTeamTotals(
          tx,
          c.participants.map((p) => p.collectorId),
        );
        await notifyCollection(
          tx,
          collectionId,
          `allocation:${collectionId}:${version}`,
          "MATERIAL_ALLOCATION",
          "Divisão dos materiais confirmada",
          "A cooperativa conferiu e registrou a parcela de cada participante. Consulte seus materiais na coleta.",
        );
      },
      { timeout: 20000 },
    );
  },
};
