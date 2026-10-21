import type { FastifyInstance } from "fastify";
import { ZodError, z } from "zod";
import { prisma } from "../../lib/prisma";
import {
  reportScope,
  runReport,
  ReportError,
} from "../reports/reports.service";
import { querySchema, period } from "../reports/reports.schemas";
import { collectionRow } from "../reports/reports.model";
export async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    "/dashboard/overview",
    { preHandler: [app.authenticate] },
    async (r, p) => {
      try {
        p.header("Cache-Control", "private, no-store");
        const coop = await reportScope(r.user.sub);
        const input = z
          .object({ start: z.string(), end: z.string() })
          .strict()
          .parse(r.query);
        const q = querySchema.parse({ ...input, export: "false" });
        const report = await runReport(coop, q, "overview");
        const today = new Date(Date.now() - 3 * 3600000)
            .toISOString()
            .slice(0, 10),
          todayPeriod = period({ start: today, end: today });
        const id = coop.id,
          entryWhere = {
            cooperativeId: id,
            remainingQuantity: { gt: 0 },
            collection: { status: { not: "CANCELLED" as const } },
          };
        const selection = {
          id: true,
          status: true,
          collectedAt: true,
          receivedAt: true,
          completedAt: true,
          createdAt: true,
          totalWeightKg: true,
          binId: true,
          generatorId: true,
          collectorId: true,
          vehicleId: true,
          driverId: true,
          routeId: true,
          bin: { select: { name: true, binId: true, city: true } },
          generator: {
            select: { name: true, companyName: true, city: true, type: true },
          },
          collector: { select: { name: true } },
          driver: { select: { name: true } },
          vehicle: { select: { plate: true } },
          route: { select: { name: true, scheduledDate: true } },
          schedule: { select: { scheduledDate: true } },
          collectionMaterials: {
            select: {
              id: true,
              wasteTypeId: true,
              nameSnapshot: true,
              categorySnapshot: true,
              quantity: true,
              unit: true,
            },
          },
        };
        const [
          requested,
          inProgress,
          awaitingReceipt,
          pendingDestination,
          pendingUnits,
          generators,
          bins,
          openAlerts,
          criticalAlerts,
          recent,
          todayRows,
        ] = await prisma.$transaction([
          prisma.schedule.count({
            where: { cooperativeId: id, status: "REQUESTED" },
          }),
          prisma.collection.count({
            where: { cooperativeId: id, status: "IN_PROGRESS" },
          }),
          prisma.collection.count({
            where: { cooperativeId: id, status: "COLLECTED" },
          }),
          prisma.collectionWasteEntry.count({ where: entryWhere }),
          prisma.collectionWasteEntry.groupBy({
            by: ["unit"],
            orderBy: { unit: "asc" },
            where: entryWhere,
            _sum: { remainingQuantity: true },
          }),
          prisma.generator.findMany({
            where: { cooperativeId: id },
            select: {
              id: true,
              name: true,
              companyName: true,
              city: true,
              status: true,
              latitude: true,
              longitude: true,
            },
            orderBy: { id: "asc" },
            take: 1001,
          }),
          prisma.bin.findMany({
            where: { cooperativeId: id },
            select: {
              id: true,
              name: true,
              binId: true,
              city: true,
              status: true,
              latitude: true,
              longitude: true,
              needsPickup: true,
            },
            orderBy: { id: "asc" },
            take: 1001,
          }),
          prisma.systemAlert.count({
            where: {
              cooperativeId: id,
              status: "OPEN",
              OR: [
                { snoozedUntil: null },
                { snoozedUntil: { lte: new Date() } },
              ],
            },
          }),
          prisma.systemAlert.count({
            where: {
              cooperativeId: id,
              status: "OPEN",
              priority: "CRITICAL",
              OR: [
                { snoozedUntil: null },
                { snoozedUntil: { lte: new Date() } },
              ],
            },
          }),
          prisma.collection.findMany({
            where: { cooperativeId: id },
            select: selection,
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take: 8,
          }),
          prisma.collection.findMany({
            where: {
              cooperativeId: id,
              OR: [
                { schedule: { scheduledDate: todayPeriod } },
                { scheduleId: null, route: { scheduledDate: todayPeriod } },
              ],
            },
            select: selection,
            orderBy: { id: "asc" },
            take: 51,
          }),
        ]);
        const point = (x: any, kind: string) => ({
          id: x.id,
          kind,
          name: x.companyName || x.name || x.binId,
          city: x.city || "Não informado",
          latitude: x.latitude,
          longitude: x.longitude,
          status: x.status,
          needsPickup: !!x.needsPickup,
        });
        return {
          data: {
            cooperative: coop,
            generatedAt: new Date().toISOString(),
            today,
            query: input,
            operational: {
              requested,
              inProgress,
              awaitingReceipt,
              pendingDestination,
              pendingUnits: Object.fromEntries(
                pendingUnits.map((x) => [
                  x.unit,
                  Number(x._sum?.remainingQuantity ?? 0),
                ]),
              ),
              openAlerts,
              criticalAlerts,
            },
            period: {
              summary: report.summary,
              previous: report.previous,
              series: report.series,
              materials: report.materialTotals,
              warnings: report.meta.warnings,
            },
            stock: report.flow?.stock || {},
            map: {
              points: [
                ...generators.slice(0, 1000).map((x) => point(x, "GENERATOR")),
                ...bins.slice(0, 1000).map((x) => point(x, "PEV")),
              ],
              truncated: generators.length > 1000 || bins.length > 1000,
            },
            todayRows: todayRows.slice(0, 50).map((c) => ({
              ...collectionRow(c, { dateBasis: "scheduledDate" }),
              date: c.schedule?.scheduledDate || c.route?.scheduledDate || null,
            })),
            todayTruncated: todayRows.length > 50,
            recent: recent.map((c) =>
              collectionRow(c, { dateBasis: "createdAt" }),
            ),
          },
        };
      } catch (e: any) {
        if (e instanceof ZodError)
          return p
            .code(400)
            .send({ error: e.issues.map((x) => x.message).join(" ") });
        if (e instanceof ReportError)
          return p.code(e.statusCode).send({ error: e.message });
        r.log.error({ code: e.code }, "Falha no painel inicial");
        return p.code(500).send({
          error:
            "Não foi possível carregar o painel. Confira a API e suas migrações.",
        });
      }
    },
  );
}
