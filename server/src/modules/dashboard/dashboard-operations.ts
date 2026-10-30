import {
  fieldOperations,
  independentFieldCollection,
  waitingForDeparture,
} from "./field-operations";
import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
function countGroup(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "_all" in value)
    return Number(value._all || 0);
  return 0;
}
export async function operationalOverview(id: string) {
  const scheduleWhere: Prisma.ScheduleWhereInput = {
    cooperativeId: id,
    status: "REQUESTED",
    collections: { none: {} },
  };
  const extraWhere: Prisma.ExtraCollectionOrderWhereInput = {
    cooperativeId: id,
    status: { in: ["PENDING_REVIEW", "NEEDS_INFO"] },
  };
  const pevWhere: Prisma.PevRequestWhereInput = {
    cooperativeId: id,
    status: "OPEN",
    collectionId: null,
  };
  const entryWhere: Prisma.CollectionWasteEntryWhereInput = {
    cooperativeId: id,
    collection: {
      status: { in: ["RECEIVED", "SORTING", "COMPLETED"] },
      quantityReviewVersion: { gt: 0 },
    },
    OR: [
      { remainingQuantity: { gt: 0 } },
      {
        destinations: {
          some: { status: "ACTIVE", type: { in: ["TRIAGE", "RESERVATION"] } },
        },
      },
    ],
  };
  const [
    schedules,
    extras,
    pevs,
    scheduled,
    awaitingReceipt,
    reviewPending,
    pendingEntries,
    pendingUnits,
    distinctPending,
    openAlerts,
    criticalAlerts,
    scheduleRows,
    extraRows,
    pevRows,
    fieldRows,
    intermediateEntries,
  ] = await prisma.$transaction([
    prisma.schedule.count({ where: scheduleWhere }),
    prisma.extraCollectionOrder.count({ where: extraWhere }),
    prisma.pevRequest.groupBy({
      by: ["binId"],
      where: pevWhere,
      orderBy: { binId: "asc" },
      _count: { _all: true },
    }),
    prisma.collection.count({
      where: { cooperativeId: id, ...waitingForDeparture },
    }),
    prisma.collection.count({
      where: { cooperativeId: id, status: "COLLECTED" },
    }),
    prisma.collection.count({
      where: {
        cooperativeId: id,
        status: { in: ["RECEIVED", "SORTING"] },
        quantityReviewVersion: 0,
      },
    }),
    prisma.collectionWasteEntry.count({ where: entryWhere }),
    prisma.collectionWasteEntry.groupBy({
      by: ["unit"],
      orderBy: { unit: "asc" },
      where: entryWhere,
      _sum: { remainingQuantity: true },
    }),
    prisma.collection.count({
      where: {
        cooperativeId: id,
        collectionWasteEntries: { some: entryWhere },
      },
    }),
    prisma.systemAlert.count({
      where: {
        cooperativeId: id,
        status: "OPEN",
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
      },
    }),
    prisma.systemAlert.count({
      where: {
        cooperativeId: id,
        status: "OPEN",
        priority: "CRITICAL",
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
      },
    }),
    prisma.schedule.findMany({
      where: scheduleWhere,
      take: 5,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        generator: { select: { name: true } },
        requestedBy: { select: { displayName: true } },
      },
    }),
    prisma.extraCollectionOrder.findMany({
      where: extraWhere,
      take: 5,
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, status: true, reporterName: true },
    }),
    prisma.pevRequest.groupBy({
      by: ["binId"],
      where: pevWhere,
      _min: { createdAt: true },
      _count: { _all: true },
      orderBy: { _min: { createdAt: "asc" } },
      take: 5,
    }),
    prisma.collection.findMany({
      where: { cooperativeId: id, ...independentFieldCollection },
      take: 5,
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        startedAt: true,
        collector: { select: { name: true } },
        generator: { select: { name: true } },
        bin: { select: { name: true, binId: true } },
        vehicle: { select: { plate: true } },
        route: { select: { name: true } },
      },
    }),
    prisma.collectionWasteEntry.count({
      where: {
        cooperativeId: id,
        collection: {
          status: { in: ["RECEIVED", "SORTING", "COMPLETED"] },
          quantityReviewVersion: { gt: 0 },
        },
        destinations: {
          some: { status: "ACTIVE", type: { in: ["TRIAGE", "RESERVATION"] } },
        },
      },
    }),
  ]);
  const fieldOverview = await fieldOperations(id);
  const bins = await prisma.bin.findMany({
    where: { cooperativeId: id, id: { in: pevRows.map((x) => x.binId) } },
    select: { id: true, name: true, binId: true },
  });
  const pending = [
    ...scheduleRows.map((x) => ({
      id: x.id,
      kind: "Solicitação",
      name: x.generator?.name || x.requestedBy.displayName,
      date: x.createdAt,
      href: "/collection-requests",
    })),
    ...extraRows.map((x) => ({
      id: x.id,
      kind: "O.C. extra",
      name: x.reporterName,
      date: x.createdAt,
      href: "/extra-collection-orders",
    })),
    ...pevRows.map((x) => ({
      id: x.binId,
      kind: `PEV · ${countGroup(x._count)} relato(s)`,
      name:
        bins.find((b) => b.id === x.binId)?.name ||
        bins.find((b) => b.id === x.binId)?.binId ||
        "PEV",
      date: x._min?.createdAt,
      href: "/bin-list/" + encodeURIComponent(x.binId),
    })),
  ]
    .sort((a, b) => +(a.date || 0) - +(b.date || 0))
    .slice(0, 8);
  return {
    intermediateEntries,
    generatedAt: new Date(),
    requested: schedules + extras + pevs.length,
    requestSources: {
      schedules,
      extraOrders: extras,
      pevPoints: pevs.length,
      pevReports: pevs.reduce((n, p) => n + countGroup(p._count), 0),
    },
    scheduled,
    inProgress: fieldOverview.count,
    fieldSources: fieldOverview.sources,
    awaitingReceipt,
    reviewPending,
    pendingDestination: distinctPending,
    pendingEntries,
    pendingUnits: Object.fromEntries(
      pendingUnits
        .filter((x) => Number(x._sum?.remainingQuantity || 0) > 0)
        .map((x) => [x.unit, Number(x._sum?.remainingQuantity || 0)]),
    ),
    openAlerts,
    criticalAlerts,
    pending,
    field: [
      ...fieldOverview.routes,
      ...fieldRows.map((c) => ({
        ...c,
        kind: "COLLECTION",
        href: `/waste-list?tipo=normal&coleta=${encodeURIComponent(c.id)}`,
      })),
    ]
      .sort((a, b) => +(a.startedAt || 0) - +(b.startedAt || 0))
      .slice(0, 8),
  };
}
