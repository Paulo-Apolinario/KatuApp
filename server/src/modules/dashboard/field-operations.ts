import { fixedExecutionWhere } from "../waste-workspace/field-operations.service";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
export const independentFieldCollection: Prisma.CollectionWhereInput = {
  status: "IN_PROGRESS",
  OR: [{ routeId: null }, { route: { status: { not: "IN_PROGRESS" } } }],
};
export const waitingForDeparture: Prisma.CollectionWhereInput = {
  status: "PENDING",
  OR: [{ routeId: null }, { route: { status: { not: "IN_PROGRESS" } } }],
};
export async function fieldOperations(cooperativeId: string) {
  const [routeCount, fixedCount, individualCount, routes] =
    await prisma.$transaction([
      prisma.route.count({ where: { cooperativeId, status: "IN_PROGRESS" } }),
      prisma.route.count({
        where: { cooperativeId, status: "IN_PROGRESS", ...fixedExecutionWhere },
      }),
      prisma.collection.count({
        where: { cooperativeId, ...independentFieldCollection },
      }),
      prisma.route.findMany({
        where: { cooperativeId, status: "IN_PROGRESS" },
        take: 5,
        orderBy: [{ startedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          planId: true,
          executionDate: true,
          startedAt: true,
          scheduledDate: true,
          driver: { select: { name: true } },
          vehicle: { select: { plate: true } },
        },
      }),
    ]);
  const groups = await prisma.collection.groupBy({
    by: ["routeId", "status"],
    where: { cooperativeId, routeId: { in: routes.map((r) => r.id) } },
    orderBy: [{ routeId: "asc" }, { status: "asc" }],
    _count: { _all: true },
  });
  return {
    count: routeCount + individualCount,
    sources: {
      routes: routeCount,
      fixedRoutes: fixedCount,
      otherRoutes: routeCount - fixedCount,
      collections: individualCount,
    },
    routes: routes.map((r) => {
      const points = groups.filter((g) => g.routeId === r.id),
        total = points.reduce((sum, g) => sum + g._count._all, 0),
        pending = points
          .filter((g) => ["PENDING", "IN_PROGRESS"].includes(g.status))
          .reduce((sum, g) => sum + g._count._all, 0);
      return {
        ...r,
        kind: "ROUTE",
        name: r.name,
        points: total,
        remainingPoints: pending,
        href: `/waste-list?tipo=${r.planId || r.executionDate ? "fixed" : "normal"}&execucao=${encodeURIComponent(r.id)}&emCampo=true`,
      };
    }),
  };
}
