import { eligibleImpactFactor } from "./impact-factor";
import {
  calculationMode,
  referenceMethodology,
  referenceFactors,
} from "./reference-factors";
import { physicalFlows } from "./impact-flows.service";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { EXECUTED } from "../reports/reports.model";
import { period, querySchema } from "../reports/reports.schemas";
import { ImpactAccessError } from "./impact-summary.service";
import { impactDate } from "./impact.model";
import { materialCodes } from "./material-profile";
import {
  addImpact,
  civilDay,
  finishImpact,
  newImpactTotals,
  selectedAnalysisMaterials,
} from "./impact-analysis.model";
export const analysisQuery = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    generatorId: z.string().max(100).optional(),
    materialId: z.string().max(100).optional(),
    materialCode: z.enum(materialCodes).optional(),
    stage: z.enum(["ALL", "CONFIRMED", "PROVISIONAL"]).default("ALL"),
  })
  .strict()
  .superRefine((v, c) => {
    if (Boolean(v.start) !== Boolean(v.end) || (v.year && v.start))
      c.addIssue({
        code: "custom",
        message: "Informe um ano ou um período completo.",
      });
  });
export async function analyzeImpact(
  userId: string,
  input: z.infer<typeof analysisQuery>,
) {
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
    generator = ["GENERATOR_SMALL", "GENERATOR_LARGE"].includes(u.role);
  const coop = owner
    ? u.cooperative?.id
    : cat
      ? u.collector?.cooperativeId
      : generator
        ? u.generator?.cooperativeId
        : undefined;
  const gen = owner
    ? input.generatorId
    : generator
      ? u.generator?.id
      : undefined;
  if (
    !u.isActive ||
    u.accountStatus !== "ACTIVE" ||
    !coop ||
    (cat && u.collector?.status === "INACTIVE") ||
    (generator && !gen) ||
    (!owner && input.generatorId && input.generatorId !== gen)
  )
    throw new ImpactAccessError("Sem vínculo para consultar este impacto.");
  const dates = input.year
    ? { start: `${input.year}-01-01`, end: `${input.year}-12-31` }
    : input.start
      ? { start: input.start, end: input.end! }
      : null;
  const range = dates ? period(querySchema.parse({ ...dates })) : undefined;
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
      const items = await tx.wasteStockItem.findMany({
        where: { cooperativeId: coop },
        select: {
          id: true,
          name: true,
          category: true,
          subcategory: true,
          wasteClass: true,
          technicalProfile: true,
        },
      });
      if (input.materialId && !items.some((i) => i.id === input.materialId))
        throw new ImpactAccessError(
          "Material não encontrado nesta cooperativa.",
          404,
        );
      const catalog = new Map(items.map((i) => [i.id, i]));
      const cfg = await tx.reportConfiguration.findUnique({
        where: { cooperativeId: coop },
      });
      const methodology = (cfg?.payload as any)?.methodology || { factors: [] };
      const total = newImpactTotals(),
        materials = new Map<string, any>(),
        generators = new Map<string, any>(),
        months = new Map<string, any>();
      const trace: any[] = [];
      let legacyDates = 0,
        traceTotal = 0,
        cursor: string | undefined;
      const participation: Prisma.CollectionWhereInput = cat
        ? {
            OR: [
              { collectorId: u.collector!.id },
              { participants: { some: { collectorId: u.collector!.id } } },
            ],
          }
        : {};
      const dateWhere = range
        ? {
            OR: [
              { collectedAt: range },
              { collectedAt: null, receivedAt: range },
              { collectedAt: null, receivedAt: null, completedAt: range },
              {
                collectedAt: null,
                receivedAt: null,
                completedAt: null,
                createdAt: range,
              },
            ],
          }
        : {};
      while (true) {
        const rows = await tx.collection.findMany({
          where: {
            AND: [
              {
                cooperativeId: coop,
                ...(gen ? { generatorId: gen } : {}),
                status: { in: [...EXECUTED] as any },
              },
              participation,
              dateWhere,
              input.stage === "CONFIRMED"
                ? { quantitiesReviewedAt: { not: null } }
                : input.stage === "PROVISIONAL"
                  ? { quantitiesReviewedAt: null }
                  : {},
            ],
          },
          select: {
            id: true,
            generatorId: true,
            binId: true,
            status: true,
            collectedAt: true,
            receivedAt: true,
            completedAt: true,
            createdAt: true,
            quantitiesReviewedAt: true,
            totalWeightKg: true,
            materials: true,
            generator: { select: { name: true, companyName: true } },
            collectionMaterials: {
              select: {
                id: true,
                wasteTypeId: true,
                nameSnapshot: true,
                categorySnapshot: true,
                subcategorySnapshot: true,
                unit: true,
                quantity: true,
                updatedAt: true,
                identificationSnapshot: true,
              },
            },
          },
          orderBy: { id: "asc" },
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!rows.length) break;
        for (const c of rows) {
          const ms = selectedAnalysisMaterials(c, catalog, input);
          if (!ms.length && (input.materialId || input.materialCode)) continue;
          addImpact(total, c, ms, methodology);
          if (!c.collectedAt) legacyDates++;
          const originId =
            c.generatorId || (c.binId ? "__pevs__" : "__avulsas__");
          const group = generators.get(originId) || {
            id: originId,
            name:
              c.generator?.companyName ||
              c.generator?.name ||
              (c.binId ? "PEVs" : "Pessoas / locais sem cadastro"),
            totals: newImpactTotals(),
          };
          addImpact(group.totals, c, ms, methodology);
          generators.set(originId, group);
          const month = civilDay(impactDate(c)).slice(0, 7),
            monthTotal = months.get(month) || newImpactTotals();
          addImpact(monthTotal, c, ms, methodology);
          months.set(month, monthTotal);
          for (const m of ms) {
            const appliedFactor = eligibleImpactFactor(c, m, methodology);
            const key = `${appliedFactor?.id || "custom"}|${m.materialId || m.name}|${m.unit}|${m.profile?.materialCode || "UNKNOWN"}|${m.identificationBasis}`;
            const group = materials.get(key) || {
              id: key,
              materialId: m.materialId,
              name: m.name,
              materialCode: m.profile?.materialCode || "UNKNOWN",
              identificationBasis: m.identificationBasis,
              factorReference:
                appliedFactor?.calculationBasis === "REFERENCE"
                  ? appliedFactor
                  : null,
              totals: newImpactTotals(),
            };
            addImpact(group.totals, c, [m], methodology);
            materials.set(key, group);
          }
          traceTotal++;
          // Bounded recent sample, independent of UUID/cuid ordering.
          trace.push({
            id: c.id,
            date: impactDate(c),
            origin: group.name,
            confirmed: Boolean(c.quantitiesReviewedAt),
            materials: ms.map((m) => ({
              name: m.name,
              quantity: m.quantity,
              unit: m.unit,
              materialCode: m.profile?.materialCode || "UNKNOWN",
              identificationBasis: m.identificationBasis,
              collectionMaterialId: m.id,
              updatedAt: c.collectionMaterials.find((x) => x.id === m.id)
                ?.updatedAt,
              profile: m.profile,
            })),
          });
          trace.sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime() ||
              a.id.localeCompare(b.id),
          );
          if (trace.length > 50) trace.pop();
        }
        cursor = rows.at(-1)!.id;
        if (rows.length < 500) break;
      }
      const originScope: Prisma.CollectionWhereInput = {
        AND: [
          {
            cooperativeId: coop,
            ...(gen ? { generatorId: gen } : {}),
            status: { in: [...EXECUTED] as any },
          },
          participation,
          input.stage === "CONFIRMED"
            ? { quantitiesReviewedAt: { not: null } }
            : input.stage === "PROVISIONAL"
              ? { quantitiesReviewedAt: null }
              : {},
        ],
      };
      const flows = await physicalFlows(
        tx,
        coop,
        originScope,
        catalog,
        input,
        range,
        Boolean(gen || cat || input.stage !== "ALL"),
      );
      const schedules = await tx.schedule.findMany({
        where: {
          cooperativeId: coop,
          ...(gen ? { generatorId: gen } : {}),
          ...(range ? { createdAt: range } : {}),
          ...(cat ? { collections: { some: participation } } : {}),
        },
        select: { id: true, status: true },
      });
      const orders = await tx.extraCollectionOrder.findMany({
        where: {
          cooperativeId: coop,
          ...(range ? { createdAt: range } : {}),
          ...(cat ? { collectorId: u.collector!.id } : {}),
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
          status: true,
          sourceScheduleId: true,
          collection: { select: { scheduleId: true } },
        },
      });
      const scheduleIds = new Set(schedules.map((s) => s.id)),
        uniqueOrders = orders.filter(
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
        ...finishImpact(total),
        flows,
        requests,
        pendingRequests,
        start: dates?.start || null,
        end: dates?.end || null,
        scope: cat
          ? "COLLECTOR_PARTICIPATION"
          : gen
            ? "GENERATOR"
            : "COOPERATIVE",
        legacyDateCollections: legacyDates,
        basis:
          "Data da coleta em Fortaleza (UTC−03); registros legados usam recebimento, conclusão ou criação, nesta ordem.",
        description:
          "Potencial ambiental estimado, sem comprovação de reciclagem ou crédito de carbono. Coletas e suas frações não devem ser somadas novamente como novos benefícios. Litros, unidades e m³ não são convertidos em kg.",
        methodology:
          calculationMode(methodology) === "REFERENCE"
            ? referenceMethodology()
            : methodology,
        calculationMode: calculationMode(methodology),
        referenceFactors,
        methodologyRevision: cfg?.version || 0,
        methodologyStatus:
          calculationMode(methodology) === "REFERENCE"
            ? "AUTOMATIC_REFERENCE"
            : methodology.approved
              ? "DECLARED_APPROVED"
              : "PENDING_VALIDATION",
        materials: [...materials.values()].map((g) => ({
          ...g,
          ...finishImpact(g.totals),
          totals: undefined,
        })),
        generators: [...generators.values()].map((g) => ({
          ...g,
          ...finishImpact(g.totals),
          totals: undefined,
        })),
        monthly: [...months]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, t]) => ({ month, ...finishImpact(t) })),
        trace,
        traceTotal,
        catalog: owner ? items : undefined,
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
