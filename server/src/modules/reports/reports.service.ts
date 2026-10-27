import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ReportQuery, period, previous, configSchema } from "./reports.schemas";
import {
  assetRows,
  buildCharts,
  collectionRow,
  emptyConfig,
  labels,
  quantities,
  mass,
  EXECUTED,
  selectedMaterials,
  summarize,
  wasteRows,
} from "./reports.model";
export class ReportError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
const LIMIT = 20000;
const pointSelect = {
  id: true,
  name: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
};
const collectionSelect = {
  id: true,
  cooperativeId: true,
  generatorId: true,
  binId: true,
  collectorId: true,
  driverId: true,
  vehicleId: true,
  routeId: true,
  status: true,
  collectedAt: true,
  receivedAt: true,
  completedAt: true,
  createdAt: true,
  totalWeightKg: true,
  participants: true,
  allocationVersion: true,
  allocationQuantityVersion: true,
  quantityReviewVersion: true,
  generator: { select: { ...pointSelect, companyName: true, type: true } },
  bin: { select: { ...pointSelect, binId: true } },
  collector: { select: { id: true, name: true } },
  driver: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true } },
  route: { select: { id: true, name: true } },
  schedule: { select: { scheduledDate: true } },
  collectionMaterials: {
    select: {
      id: true,
      wasteTypeId: true,
      nameSnapshot: true,
      categorySnapshot: true,
      quantity: true,
      unit: true,
      wasteEntry: { select: { id: true, remainingQuantity: true, unit: true } },
    },
  },
} satisfies Prisma.CollectionSelect;
export async function reportScope(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      accountStatus: true,
      cooperative: {
        select: {
          id: true,
          name: true,
          registrationNumber: true,
          city: true,
          state: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });
  if (
    !u ||
    !u.isActive ||
    u.accountStatus !== "ACTIVE" ||
    u.role !== "COOPERATIVE" ||
    !u.cooperative
  )
    throw new ReportError(
      "Relatórios disponíveis apenas para a cooperativa autenticada.",
      403,
    );
  return u.cooperative;
}
function scopeWhere(id: string, q: ReportQuery): Prisma.CollectionWhereInput {
  return {
    cooperativeId: id,
    AND: [
      ...(q.collectorId ? [{ OR: [{ collectorId: q.collectorId }, { participants: { some: { collectorId: q.collectorId } } }] }] : []),
      ...(q.binId ? [{ binId: q.binId }] : []),
      ...(q.materialId || q.unit
        ? [
            {
              OR: [
                {
                  collectionMaterials: {
                    some: {
                      ...(q.materialId ? { wasteTypeId: q.materialId } : {}),
                      ...(q.unit ? { unit: q.unit } : {}),
                    },
                  },
                },
                ...(!q.materialId && q.unit === "KG"
                  ? [
                      {
                        collectionMaterials: { none: {} },
                        totalWeightKg: { gt: 0 },
                      },
                    ]
                  : []),
              ],
            },
          ]
        : []),
    ],
    ...(q.status ? { status: q.status } : {}),
    ...(q.routeId ? { routeId: q.routeId } : {}),
    ...(q.generatorId ? { generatorId: q.generatorId } : {}),
    ...(q.driverId ? { driverId: q.driverId } : {}),
    ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
    ...(q.origin === "PEV"
      ? { binId: { not: null } }
      : q.origin === "GENERATOR"
        ? { binId: null, generatorId: { not: null } }
        : q.origin === "UNIDENTIFIED"
          ? { binId: null, generatorId: null }
          : {}),
    ...(q.generatorType ? { generator: { type: q.generatorType } } : {}),
    ...(q.city
      ? {
          OR: [
            { generator: { city: { equals: q.city, mode: "insensitive" } } },
            { bin: { city: { equals: q.city, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}
function where(id: string, q: ReportQuery) {
  return {
    ...scopeWhere(id, q),
    ...(q.dateBasis === "scheduledDate"
      ? { schedule: { scheduledDate: period(q) } }
      : { [q.dateBasis]: period(q) }),
  } as Prisma.CollectionWhereInput;
}
function limited<T>(rows: T[]) {
  if (rows.length > LIMIT)
    throw new ReportError(
      "O recorte ultrapassa 20 mil registros. Reduza o período ou refine os filtros para emitir um relatório completo, sem truncamento.",
      422,
    );
  return rows;
}
async function config(db: any, id: string) {
  const row = await db.reportConfiguration.findUnique({
    where: { cooperativeId: id },
  });
  return row
    ? { ...(row.payload as any), version: row.version }
    : { ...emptyConfig, version: 0 };
}
export async function reportContext(coop: any) {
  const id = coop.id;
  const [
    generators,
    collectors,
    drivers,
    vehicles,
    routes,
    materials,
    bins,
    settings,
  ] = await prisma.$transaction([
    prisma.generator.findMany({
      where: { cooperativeId: id },
      select: {
        id: true,
        name: true,
        companyName: true,
        city: true,
        type: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.collector.findMany({
      where: { cooperativeId: id },
      select: { id: true, name: true, status: true },
    }),
    prisma.driver.findMany({
      where: { cooperativeId: id },
      select: { id: true, name: true, status: true },
    }),
    prisma.vehicle.findMany({
      where: { cooperativeId: id },
      select: { id: true, plate: true, model: true, status: true },
    }),
    prisma.route.findMany({
      where: { cooperativeId: id },
      select: { id: true, name: true },
    }),
    prisma.wasteStockItem.findMany({
      where: { cooperativeId: id },
      select: { id: true, name: true, unit: true },
    }),
    prisma.bin.findMany({
      where: { cooperativeId: id },
      select: { id: true, name: true, binId: true, city: true },
    }),
    prisma.reportConfiguration.findUnique({ where: { cooperativeId: id } }),
  ]);
  const branding = await prisma.cooperativeSettings.findUnique({where:{cooperativeId:coop.id},select:{payload:true}});
  return {
    cooperative: { ...coop, logo: (branding?.payload as any)?.company?.logo || "" },
    generators,
    collectors,
    drivers,
    vehicles,
    routes,
    materials,
    bins,
    cities: [
      ...new Set(
        [...generators.map((g) => g.city), ...bins.map((b) => b.city)].filter(
          Boolean,
        ),
      ),
    ].sort(),
    settings: settings
      ? { ...(settings.payload as any), version: settings.version }
      : { ...emptyConfig, version: 0 },
  };
}
async function dataset(db: any, id: string, q: ReportQuery, kind: string) {
  const needsDest =
      kind === "overview" || (kind === "waste" && q.stage === "DESTINED"),
    needsStock =
      kind === "overview" || (kind === "waste" && q.stage === "STOCK");
  const collectionQuery =
    kind === "waste" && q.stage === "RECEIVED"
      ? { ...q, dateBasis: "receivedAt" as const }
      : q;
  const stockFilter: any = {
    cooperativeId: id,
    ...(q.unit ? { unit: q.unit } : {}),
    ...(q.materialId ? { stockItemId: q.materialId } : {}),
    ...(q.lotStatus ? { status: q.lotStatus } : {}),
    ...(q.processingStage ? { processingStage: q.processingStage } : {}),
    ...(q.routeId ||
    q.generatorId ||
    q.collectorId ||
    q.driverId ||
    q.vehicleId ||
    q.binId ||
    q.generatorType ||
    q.origin ||
    q.city ||
    q.status
      ? { originCollection: scopeWhere(id, q) }
      : {}),
  };
  const [
    collections,
    old,
    undated,
    destinations,
    lots,
    collectors,
    drivers,
    vehicles,
    routes,
    maintenance,
    documents,
    settings,
  ] = await Promise.all([
    kind === "waste" && ["STOCK", "DESTINED"].includes(q.stage)
      ? []
      : db.collection.findMany({
          where: where(id, collectionQuery),
          select: collectionSelect,
          take: LIMIT + 1,
        }),
    kind === "overview"
      ? db.collection.findMany({
          where: where(id, previous(q)),
          select: collectionSelect,
          take: LIMIT + 1,
        })
      : [],
    db.collection.count({
      where: {
        AND: [
          scopeWhere(id, collectionQuery),
          {
            ...(collectionQuery.dateBasis === "scheduledDate"
              ? {
                  OR: [
                    { scheduleId: null },
                    { schedule: { scheduledDate: null } },
                  ],
                }
              : { [collectionQuery.dateBasis]: null }),
          },
        ],
      },
    }),
    needsDest
      ? db.collectionWasteDestination.findMany({
          where: {
            cooperativeId: id,
            status: "ACTIVE",
            destinationDate: period(q),
            ...(q.unit ? { unit: q.unit } : {}),
            collectionWasteEntry: {
              ...(q.materialId ? { wasteTypeId: q.materialId } : {}),
              cooperativeId: id,
              collection: {
                AND: [scopeWhere(id, q), { status: { not: "CANCELLED" } }],
              },
            },
          },
          select: {
            id: true,
            collectionWasteEntryId: true,
            type: true,
            quantity: true,
            unit: true,
            destinationDate: true,
            destinationName: true,
            stockLot: { select: { code: true, lotCode: true } },
            collectionWasteEntry: {
              select: { materialNameSnapshot: true, collectionId: true },
            },
          },
          take: LIMIT + 1,
        })
      : [],
    needsStock
      ? db.wasteStockLot.findMany({
          where: stockFilter,
          select: {
            id: true,
            unit: true,
            quantity: true,
            availableQuantity: true,
            status: true,
            processingStage: true,
            lotCode: true,
            code: true,
            receivedAt: true,
            storageLocation: true,
            originCollectionId: true,
            originCollectionWasteEntryId: true,
            stockItem: { select: { name: true } },
            originCollection: { select: { binId: true, generatorId: true } },
          },
          take: LIMIT + 1,
        })
      : [],
    kind === "staff"
      ? db.collector.findMany({
          where: {
            cooperativeId: id,
            ...(q.collectorId ? { id: q.collectorId } : {}),
          },
          select: { id: true, name: true, status: true },
        })
      : [],
    kind === "staff"
      ? db.driver.findMany({
          where: {
            cooperativeId: id,
            ...(q.driverId ? { id: q.driverId } : {}),
          },
          select: { id: true, name: true, status: true },
        })
      : [],
    kind === "vehicles"
      ? db.vehicle.findMany({
          where: {
            cooperativeId: id,
            ...(q.vehicleId ? { id: q.vehicleId } : {}),
          },
          select: {
            id: true,
            plate: true,
            brand: true,
            model: true,
            capacityKg: true,
            status: true,
          },
        })
      : [],
    ["staff", "vehicles"].includes(kind)
      ? db.route.findMany({
          where: {
            cooperativeId: id,
            scheduledDate: period(q),
            ...(q.routeId ? { id: q.routeId } : {}),
            ...(q.driverId ? { driverId: q.driverId } : {}),
            ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
          },
          select: { id: true, driverId: true, vehicleId: true },
        })
      : [],
    kind === "vehicles"
      ? db.maintenanceLog.findMany({
          where: {
            cooperativeId: id,
            maintenanceDate: period(q),
            status: "COMPLETED",
          },
          select: { vehicleId: true, cost: true, status: true },
        })
      : [],
    kind === "vehicles"
      ? db.vehicleDocument.findMany({
          where: {
            cooperativeId: id,
            expiryDate: { lte: new Date(Date.now() + 30 * 86400000) },
          },
          select: { vehicleId: true, expiryDate: true },
        })
      : [],
    config(db, id),
  ]);
  const match = (c: any) =>
    !q.search ||
    [
      c.id,
      c.generator?.name,
      c.generator?.companyName,
      c.bin?.name,
      c.bin?.binId,
      c.route?.name,
      c.vehicle?.plate,
      c.collector?.name,
      c.driver?.name,
      ...(c.collectionMaterials || []).map((m: any) => m.nameSnapshot),
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(q.search.toLocaleLowerCase("pt-BR"));
  return {
    collections: limited(collections)
      .filter((c) => ["staff", "vehicles"].includes(kind) || match(c))
      .filter(
        (c: any) =>
          !q.execution ||
          (EXECUTED.has(c.status) &&
            (q.execution !== "MISSING_QUANTITY" ||
              !selectedMaterials(c, q).some((m: any) => m.quantity != null))),
      ),
    previous: limited(old)
      .filter(match)
      .filter(
        (c: any) =>
          !q.execution ||
          (EXECUTED.has(c.status) &&
            (q.execution !== "MISSING_QUANTITY" ||
              !selectedMaterials(c, q).some((m: any) => m.quantity != null))),
      ),
    undated,
    destinations: limited(destinations).filter(
      (d: any) =>
        !q.search ||
        [d.collectionWasteEntry.materialNameSnapshot, d.destinationName, d.id]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(q.search.toLocaleLowerCase("pt-BR")),
    ),
    lots: limited(lots).filter(
      (l: any) =>
        !q.search ||
        [l.stockItem.name, l.lotCode, l.code, l.storageLocation]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(q.search.toLocaleLowerCase("pt-BR")),
    ),
    collectors,
    drivers,
    vehicles,
    routes,
    maintenance,
    documents,
    settings,
  };
}
export async function runReport(coop: any, q: ReportQuery, kind: string) {
  const effective =
    kind === "waste" && q.stage === "RECEIVED"
      ? { ...q, dateBasis: "receivedAt" as const }
      : q;
  const data = await prisma.$transaction(
    (tx) => dataset(tx, coop.id, effective, kind),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30000,
    },
  );
  let chartCollections = data.collections;
  let rows: any[] =
    kind === "waste"
      ? wasteRows(data, effective)
      : ["staff", "vehicles"].includes(kind)
        ? assetRows(data, effective, kind)
        : data.collections.map((c: any) => collectionRow(c, effective));
  const summaries = summarize(data.collections, effective);
  if (kind === "waste") {
    const active =
      q.stage === "STOCK"
        ? rows.filter((r) => ["Disponível", "Reservado"].includes(r.status))
        : rows;
    const units = quantities(active);
    Object.assign(summaries, {
      units,
      massKg: mass(units),
      records: rows.length,
      executed: undefined,
    });
  }
  if (["staff", "vehicles"].includes(kind)) {
    const included = new Set(rows.flatMap((r) => r.collectionIds));
    const scoped = data.collections.filter((c: any) => included.has(c.id));
    chartCollections = scoped;
    Object.assign(summaries, summarize(scoped, effective), {
      assets: rows.length,
      maintenanceCost: rows.reduce((s, r) => s + (r.maintenanceCost || 0), 0),
      maintenanceWithoutCost: rows.reduce(
        (s, r) => s + (r.maintenanceWithoutCost || 0),
        0,
      ),
      expiringDocuments: rows.reduce(
        (s, r) => s + (r.expiringDocuments || 0),
        0,
      ),
    });
  }
  const direction = q.direction === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const k = q.sort;
    const av = k === "date" ? new Date(a.date || 0).getTime() : (a[k] ?? ""),
      bv = k === "date" ? new Date(b.date || 0).getTime() : (b[k] ?? "");
    return (
      direction *
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR")) ||
      String(a.id).localeCompare(String(b.id))
    );
  });
  const warnings = [
    "Quantidades de massa, volume e unidades são apresentadas separadamente. Massa equivalente em kg usa somente kg + toneladas × 1.000.",
    "Ausência de quantidade registrada não é pesagem igual a zero.",
  ];
  if (q.stage === "STOCK" && kind === "waste")
    warnings.push(
      "Estoque atual: posição consultada agora, sem reconstrução histórica. O período não delimita saldos. Disponível e reservado compõem o saldo; vendido e descartado não entram no total.",
    );
  if (data.undated && !(kind === "waste" && q.stage === "STOCK"))
    warnings.push(
      `${data.undated} registro(s) no escopo sem a data escolhida não podem ser situados no período; não se usa criação/atualização como substituição.`,
    );
  if (summaries.legacy)
    warnings.push(
      `${summaries.legacy} registro(s) de peso legado estão identificados, sem classificação presumida.`,
    );
  if (kind === "waste" && q.stage === "RECEIVED")
    warnings.push(
      "Quantidades registradas nas coletas recebidas; o sistema não possui uma segunda pesagem independente de recebimento.",
    );
  if (kind === "vehicles")
    warnings.push(
      "Capacidade é cadastral; alertas documentais representam a situação atual (vencidos ou a vencer em 30 dias). Sem telemetria, odômetro ou abastecimentos, não são calculados km, consumo ou custo de combustível.",
    );
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      cooperative: coop,
      query: effective,
      kind,
      page: q.page,
      pageSize: q.pageSize,
      total: rows.length,
      scope:
        q.stage === "STOCK" && kind === "waste"
          ? "Estoque atual"
          : "Operações da cooperativa no recorte informado",
      warnings,
      undatedInScope: data.undated,
    },
    summary: summaries,
    previous:
      kind === "overview"
        ? { ...summarize(data.previous, previous(q)), period: previous(q) }
        : null,
    ...buildCharts(chartCollections, effective, data.settings),
    flow:
      kind === "overview"
        ? {
            destined: quantities(data.destinations),
            stock: quantities(
              data.lots
                .filter((l: any) =>
                  ["AVAILABLE", "RESERVED"].includes(l.status),
                )
                .map((l: any) => ({
                  unit: l.unit,
                  quantity: l.availableQuantity,
                })),
            ),
            pendingCurrent: quantities(
              data.collections
                .filter((c: any) => EXECUTED.has(c.status))
                .flatMap((c: any) =>
                  c.collectionMaterials
                    .filter(
                      (m: any) =>
                        (!q.unit || m.unit === q.unit) &&
                        (!q.materialId || m.wasteTypeId === q.materialId),
                    )
                    .map((m: any) => ({
                      unit: m.unit,
                      quantity: m.wasteEntry?.remainingQuantity,
                    })),
                ),
            ),
          }
        : null,
    settings: data.settings,
    rows:
      q.export === "true"
        ? rows
        : rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize),
  };
}
export async function reportDetail(coop: any, id: string) {
  const c = await prisma.collection.findFirst({
    where: { id, cooperativeId: coop.id },
    select: collectionSelect,
  });
  if (!c)
    throw new ReportError("Coleta não encontrada para esta cooperativa.", 404);
  const destinations = await prisma.collectionWasteDestination.findMany({
    where: {
      cooperativeId: coop.id,
      collectionWasteEntry: { collectionId: id },
    },
    select: {
      id: true,
      type: true,
      quantity: true,
      unit: true,
      destinationDate: true,
      status: true,
      destinationName: true,
      stockLot: { select: { id: true, code: true, lotCode: true } },
    },
  });
  return {
    collection: collectionRow(c, { dateBasis: "collectedAt" }),
    destinations: destinations.map((d) => ({
      ...d,
      type: labels[d.type] || d.type,
      status: labels[d.status] || d.status,
    })),
    notice:
      "Destinações são exibidas com sua situação; canceladas não compõem os totais. Não se somam coleta e estoque como material diferente.",
  };
}
export async function saveConfig(coop: any, userId: string, input: unknown) {
  const v = configSchema.parse(input);
  const ids = v.methodology.factors.map((f) => f.materialId);
  const found = await prisma.wasteStockItem.count({
    where: { cooperativeId: coop.id, id: { in: ids } },
  });
  if (found !== ids.length)
    throw new ReportError(
      "Um material não pertence ao catálogo da cooperativa.",
    );
  const { version, ...payload } = v;
  try {
    if (version === 0) {
      const created = await prisma.reportConfiguration.createMany({
        data: [{ cooperativeId: coop.id, payload, updatedBy: userId }],
        skipDuplicates: true,
      });
      if (!created.count)
        throw new ReportError(
          "A configuração mudou. Recarregue antes de salvar.",
          409,
        );
      return await prisma.reportConfiguration.findUniqueOrThrow({
        where: { cooperativeId: coop.id },
      });
    }
    const r = await prisma.reportConfiguration.updateMany({
      where: { cooperativeId: coop.id, version },
      data: { payload, version: { increment: 1 }, updatedBy: userId },
    });
    if (!r.count)
      throw new ReportError(
        "A configuração mudou. Recarregue antes de salvar.",
        409,
      );
    return await prisma.reportConfiguration.findUniqueOrThrow({
      where: { cooperativeId: coop.id },
    });
  } catch (e: any) {
    if (e.code === "P2002")
      throw new ReportError(
        "A configuração mudou. Recarregue antes de salvar.",
        409,
      );
    throw e;
  }
}
