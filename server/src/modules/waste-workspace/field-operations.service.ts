import { Prisma, CollectionStatus, WasteUnit } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { pagination } from "./waste-workspace.model";
export const fieldQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(150).default(""),
    status: z
      .enum([
        "",
        "PENDING",
        "IN_FIELD",
        "IN_PROGRESS",
        "COLLECTED",
        "RECEIVED",
        "SORTING",
        "COMPLETED",
        "CANCELLED",
      ])
      .default(""),
    generator: z.string().max(100).default(""),
    collector: z.string().max(100).default(""),
    driver: z.string().max(100).default(""),
    vehicle: z.string().max(100).default(""),
    route: z.string().max(100).default(""),
    dateField: z
      .enum(["scheduled", "collected", "created"])
      .default("scheduled"),
    start: z.string().default(""),
    end: z.string().default(""),
    kind: z.enum(["all", "normal", "fixed"]).default("all"),
    inField: z.enum(["", "true"]).default(""),
  })
  .strict();
export const fixedExecutionWhere: Prisma.RouteWhereInput = {
  OR: [{ planId: { not: null } }, { executionDate: { not: null } }],
};
type Query = z.infer<typeof fieldQuerySchema>;
function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}
export const fieldPointSelect = {
  id: true,
  status: true,
  createdAt: true,
  startedAt: true,
  collectedAt: true,
  receivedAt: true,
  generatorId: true,
  collectorId: true,
  driverId: true,
  vehicleId: true,
  routeId: true,
  routePoint: true,
  bin: {
    select: {
      id: true,
      name: true,
      binId: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
    },
  },
  generator: {
    select: {
      id: true,
      name: true,
      address: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
    },
  },
  collector: { select: { id: true, name: true } },
  driver: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true } },
  route: {
    select: {
      id: true,
      name: true,
      scheduledDate: true,
      status: true,
      planId: true,
      startedAt: true,
      executionDate: true,
      closureOutcome: true,
    },
  },
  schedule: { select: { id: true, scheduledDate: true, preferredDate: true } },
} as const satisfies Prisma.CollectionSelect;
export function fieldPointWhere(
  id: string,
  q: Query,
): Prisma.CollectionWhereInput {
  const parts: Prisma.CollectionWhereInput[] = [{ cooperativeId: id }];
  if (q.kind === "normal")
    parts.push({
      OR: [{ routeId: null }, { route: { planId: null, executionDate: null } }],
    });
  if (q.kind === "fixed") parts.push({ route: fixedExecutionWhere });
  const field: Prisma.CollectionWhereInput = {
    OR: [
      { status: "IN_PROGRESS" },
      { status: "PENDING", route: { status: "IN_PROGRESS" } },
    ],
  };
  if (q.inField === "true" || q.status === "IN_FIELD") parts.push(field);
  else if (q.status === "PENDING")
    parts.push({
      status: "PENDING",
      OR: [{ routeId: null }, { route: { status: { not: "IN_PROGRESS" } } }],
    });
  else if (q.status) parts.push({ status: q.status });
  for (const key of [
    "generator",
    "collector",
    "driver",
    "vehicle",
    "route",
  ] as const)
    if (q[key])
      parts.push(
        key === "collector"
          ? {
              OR: [
                { collectorId: q[key] },
                { participants: { some: { collectorId: q[key] } } },
              ],
            }
          : { [key + "Id"]: q[key] },
      );
  let start: Date | undefined, end: Date | undefined;
  for (const [key, value] of [
    ["start", q.start],
    ["end", q.end],
  ])
    if (value) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(+new Date(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value
      )
        fail("Data inexistente no calendário.");
      if (key === "start") start = new Date(value + "T00:00:00-03:00");
      else end = new Date(value + "T23:59:59.999-03:00");
    }
  if (start && end && start > end) fail("Período inválido.");
  if (start || end) {
    const period = { gte: start, lte: end };
    parts.push(
      q.dateField === "scheduled"
        ? {
            OR: [
              { schedule: { scheduledDate: period } },
              {
                schedule: { scheduledDate: null },
                route: { scheduledDate: period },
              },
              { scheduleId: null, route: { scheduledDate: period } },
            ],
          }
        : q.dateField === "collected"
          ? { collectedAt: period }
          : { createdAt: period },
    );
  }
  if (q.q)
    parts.push({
      OR: [
        { id: { contains: q.q, mode: "insensitive" } },
        {
          routePoint: {
            path: ["name"],
            string_contains: q.q,
            mode: "insensitive",
          },
        },
        {
          routePoint: {
            path: ["address"],
            string_contains: q.q,
            mode: "insensitive",
          },
        },
        { generator: { name: { contains: q.q, mode: "insensitive" } } },
        { bin: { name: { contains: q.q, mode: "insensitive" } } },
        { collector: { name: { contains: q.q, mode: "insensitive" } } },
        { driver: { name: { contains: q.q, mode: "insensitive" } } },
        { vehicle: { plate: { contains: q.q, mode: "insensitive" } } },
        { route: { name: { contains: q.q, mode: "insensitive" } } },
        {
          incidents: {
            some: { description: { contains: q.q, mode: "insensitive" } },
          },
        },
        {
          collectionMaterials: {
            some: { nameSnapshot: { contains: q.q, mode: "insensitive" } },
          },
        },
      ],
    });
  return { AND: parts };
}
function statsQueries(where: Prisma.CollectionWhereInput) {
  return [
    prisma.collection.count({ where }),
    prisma.collection.groupBy({
      by: ["status"],
      where,
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
    prisma.collectionMaterial.groupBy({
      by: ["unit"],
      where: { collection: { AND: [where, { status: { not: "CANCELLED" } }] } },
      orderBy: { unit: "asc" },
      _sum: { quantity: true },
    }),
    prisma.collectionIncident.count({
      where: { collection: where, status: "OPEN" },
    }),
  ] as const;
}
type StatsResult = [
  number,
  { status: CollectionStatus; _count: { _all: number } }[],
  { unit: WasteUnit; _sum: { quantity: Prisma.Decimal | null } }[],
  number,
];
function statistics([total, groups, units, incidents]: StatsResult) {
  const counts = Object.fromEntries(
    groups.map((x) => [x.status, x._count?._all || 0]),
  );
  return {
    totalPoints: total,
    active: (counts.PENDING || 0) + (counts.IN_PROGRESS || 0),
    awaitingReceipt: counts.COLLECTED || 0,
    incidents,
    units: units.map((x) => ({
      unit: x.unit,
      quantity: Number(x._sum?.quantity || 0),
    })),
  };
}
export async function listFieldPoints(id: string, raw: unknown) {
  const q = fieldQuerySchema.parse(raw),
    where = fieldPointWhere(id, q);
  const [collections, ...stats] = await prisma.$transaction([
    prisma.collection.findMany({
      where,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: fieldPointSelect,
    }),
    ...statsQueries(where),
  ]);
  return {
    collections,
    pagination: pagination(q.page, q.limit, stats[0] as number),
    stats: statistics(stats),
  };
}
export async function listFieldRoutes(id: string, raw: unknown) {
  const q = fieldQuerySchema.parse(raw),
    point = fieldPointWhere(id, {
      ...q,
      kind: "all",
      inField: "",
      status: q.status === "IN_FIELD" ? "" : q.status,
    });
  const where: Prisma.RouteWhereInput = {
    cooperativeId: id,
    ...fixedExecutionWhere,
    collections: { some: point },
    ...(q.inField === "true" || q.status === "IN_FIELD"
      ? { status: "IN_PROGRESS" }
      : {}),
  };
  const allPoints: Prisma.CollectionWhereInput = {
    cooperativeId: id,
    route: { is: where },
  };
  const [total, ...stats] = await prisma.$transaction([
    prisma.route.count({ where }),
    ...statsQueries(allPoints),
  ]);
  const skip = (q.page - 1) * q.limit;
  const select = {
    id: true,
    name: true,
    status: true,
    planId: true,
    executionDate: true,
    closureOutcome: true,
    scheduledDate: true,
    startedAt: true,
    collectorIds: true,
    driver: { select: { id: true, name: true } },
    vehicle: { select: { id: true, plate: true } },
  } as const;
  const routes = await prisma.route.findMany({
    where,
    skip,
    take: q.limit,
    orderBy: [{ scheduledDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    select,
  });
  const groups = await prisma.collection.groupBy({
    by: ["routeId", "status"],
    where: { cooperativeId: id, routeId: { in: routes.map((r) => r.id) } },
    orderBy: [{ routeId: "asc" }, { status: "asc" }],
    _count: { _all: true },
  });
  const collectors = await prisma.collector.findMany({
    where: {
      cooperativeId: id,
      id: { in: [...new Set(routes.flatMap((r) => r.collectorIds))] },
    },
    select: { id: true, name: true },
  });
  return {
    routes: routes.map(({ collectorIds, ...route }) => {
      const statuses = Object.fromEntries(
        groups
          .filter((g) => g.routeId === route.id)
          .map((g) => [g.status, g._count._all]),
      );
      return {
        ...route,
        collectors: collectorIds
          .map((cid) => collectors.find((c) => c.id === cid))
          .filter(Boolean),
        points: Object.values(statuses).reduce((s, n) => s + n, 0),
        pointStatuses: statuses,
      };
    }),
    pagination: pagination(q.page, q.limit, total),
    stats: statistics(stats),
  };
}
export async function routeFieldPoints(
  id: string,
  routeId: string,
  raw: unknown,
) {
  const q = z
    .object({
      page: z.coerce.number().int().min(1).max(100000).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict()
    .parse(raw);
  const route = await prisma.route.findFirst({
    where: { id: routeId, cooperativeId: id, ...fixedExecutionWhere },
    select: { id: true, collectionOrder: true },
  });
  if (!route) fail("Execução de rota fixa não encontrada.", 404);
  const ids = await prisma.collection.findMany({
    where: { cooperativeId: id, routeId },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const ranks = new Map(route.collectionOrder.map((cid, i) => [cid, i]));
  ids.sort(
    (a, b) =>
      (ranks.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (ranks.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const pageIds = ids
    .slice((q.page - 1) * q.limit, q.page * q.limit)
    .map((c) => c.id);
  const points = await prisma.collection.findMany({
    where: { cooperativeId: id, routeId, id: { in: pageIds } },
    select: fieldPointSelect,
  });
  const byId = new Map(points.map((c) => [c.id, c]));
  return {
    collections: pageIds.map((cid) => byId.get(cid)).filter(Boolean),
    pagination: pagination(q.page, q.limit, ids.length),
  };
}
