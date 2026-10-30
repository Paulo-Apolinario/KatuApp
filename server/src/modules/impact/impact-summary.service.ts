import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { EXECUTED } from "../reports/reports.model";
import { impactSummary } from "./impact.model";
/** Referência simplificada já usada no App anterior; não é fator certificado por material. */
export const impactReference = Object.freeze({
  version: "katua-reference-v1",
  label: "Referência simplificada KATUÁ",
  co2PerKg: 1.5,
  waterPerKg: 35,
  energyPerKg: 2.3,
  treesPerKg: 0.01,
});
export function referenceImpact(kg: number) {
  return {
    co2Kg: kg * impactReference.co2PerKg,
    waterLiters: kg * impactReference.waterPerKg,
    energyKwh: kg * impactReference.energyPerKg,
    treesEquivalent: kg * impactReference.treesPerKg,
  };
}
export class ImpactAccessError extends Error {
  constructor(
    message: string,
    public statusCode = 403,
  ) {
    super(message);
  }
}
export async function impactOverview(userId: string, generatorId?: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      cooperative: { select: { id: true } },
      generator: { select: { id: true, cooperativeId: true } },
      collector: { select: { id: true, cooperativeId: true, status: true } },
    },
  });
  const owner = u.role === "COOPERATIVE",
    cat = u.role === "COLLECTOR",
    genRole = ["GENERATOR_SMALL", "GENERATOR_LARGE"].includes(u.role);
  const coop = owner
    ? u.cooperative?.id
    : cat
      ? u.collector?.cooperativeId
      : u.generator?.cooperativeId;
  const gen = owner ? generatorId : genRole ? u.generator?.id : undefined;
  if (
    !u.isActive ||
    u.accountStatus !== "ACTIVE" ||
    (!owner && !cat && !genRole) ||
    !coop ||
    (cat && u.collector?.status === "INACTIVE") ||
    (genRole && !gen) ||
    (!owner && generatorId && generatorId !== gen)
  )
    throw new ImpactAccessError("Sem vínculo para consultar este impacto.");
  return prisma.$transaction(
    async (tx) => {
      if (
        gen &&
        !(await tx.generator.findFirst({
          where: { id: gen, cooperativeId: coop },
          select: { id: true },
        }))
      )
        throw new ImpactAccessError(
          "Gerador não encontrado nesta cooperativa.",
          404,
        );
      const participation: Prisma.CollectionWhereInput = cat
        ? {
            OR: [
              { collectorId: u.collector!.id },
              { participants: { some: { collectorId: u.collector!.id } } },
            ],
          }
        : {};
      const where: Prisma.CollectionWhereInput = {
        cooperativeId: coop,
        ...(gen ? { generatorId: gen } : {}),
        ...participation,
        status: { in: [...EXECUTED] as any },
      };
      let cursor: string | undefined,
        collections = 0,
        totalMassKg = 0;
      const origins = new Map<
        string,
        { id: string; name: string; collections: number; totalMassKg: number }
      >();
      // Leitura por lotes evita truncar o acumulado em 20 mil coletas ou carregar todo o histórico de uma vez.
      while (true) {
        const rows = await tx.collection.findMany({
          where,
          orderBy: { id: "asc" },
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            generatorId: true,
            binId: true,
            status: true,
            totalWeightKg: true,
            materials: true,
            quantitiesReviewedAt: true,
            collectedAt: true,
            generator: { select: { name: true, companyName: true } },
            collectionMaterials: {
              select: {
                id: true,
                wasteTypeId: true,
                nameSnapshot: true,
                quantity: true,
                unit: true,
              },
            },
          },
        });
        if (!rows.length) break;
        const sum = impactSummary(rows, {});
        collections += rows.length;
        totalMassKg += sum.totalMassKg;
        for (const c of rows) {
          const id = c.generatorId || (c.binId ? "__pevs__" : "__avulsas__");
          const group = origins.get(id) || {
            id,
            name:
              c.generator?.companyName ||
              c.generator?.name ||
              (c.binId ? "PEVs" : "Pessoas físicas / coletas extras"),
            collections: 0,
            totalMassKg: 0,
          };
          group.collections++;
          group.totalMassKg += impactSummary([c], {}).totalMassKg;
          origins.set(id, group);
        }
        cursor = rows.at(-1)!.id;
        if (rows.length < 500) break;
      }
      const schedules = await tx.schedule.findMany({
        where: {
          cooperativeId: coop,
          ...(gen ? { generatorId: gen } : {}),
          ...(cat ? { collections: { some: participation } } : {}),
        },
        select: { id: true, status: true },
      });
      const scheduleIds = new Set(schedules.map((s) => s.id));
      const orders = await tx.extraCollectionOrder.findMany({
        where: {
          cooperativeId: coop,
          ...(cat
            ? {
                OR: [
                  { collectorId: u.collector!.id },
                  { collection: participation },
                ],
              }
            : {}),
          ...(gen
            ? {
                OR: [
                  { collection: { generatorId: gen } },
                  { payload: { path: ["generatorId"], equals: gen } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          status: true,
          sourceScheduleId: true,
          collection: { select: { scheduleId: true } },
        },
      });
      const uniqueOrders = orders.filter(
        (o) =>
          ![o.sourceScheduleId, o.collection?.scheduleId].some(
            (id) => id && scheduleIds.has(id),
          ),
      );
      const requests = schedules.length + uniqueOrders.length,
        pendingRequests =
          schedules.filter((s) =>
            ["REQUESTED", "SCHEDULED", "IN_PROGRESS"].includes(s.status),
          ).length +
          uniqueOrders.filter((o) =>
            ["PENDING_REVIEW", "NEEDS_INFO"].includes(o.status),
          ).length;
      return {
        scope: cat
          ? "COLLECTOR_PARTICIPATION"
          : gen
            ? "GENERATOR"
            : "COOPERATIVE",
        basis:
          "Todas as coletas concluídas em campo, desde o início dos registros.",
        collections,
        requests,
        pendingRequests,
        totalMassKg,
        ...referenceImpact(totalMassKg),
        reference: impactReference,
        origins: [...origins.values()].map((g) => ({
          ...g,
          ...referenceImpact(g.totalMassKg),
        })),
        description:
          "Estimativa simplificada proporcional à massa coletada, com a base de referência anterior do App. Solicitações pendentes não entram no impacto realizado. Não comprova reciclagem, emissões evitadas ou crédito ambiental. A participação em equipe não deve ser somada entre catadores; no painel, cada coleta aparece uma única vez.",
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
