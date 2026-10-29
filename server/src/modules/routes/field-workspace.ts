import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

// Opt-in contract for field profiles. Existing /routes clients are unchanged.
export function fieldWorkspaceRoute(app: FastifyInstance) {
  app.get("/field-workspace", async (request, reply) => {
    const q = z.object({ view: z.enum(["active", "history"]).default("active"), page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict().safeParse(request.query);
    if (!q.success) return reply.badRequest("Paginação de rotas inválida.");
    const userId = request.user.sub;
    let scope: Prisma.RouteWhereInput;
    if (request.user.role === "COLLECTOR") {
      const collector = await prisma.collector.findUnique({ where: { userId }, select: { id: true, cooperativeId: true, status: true } });
      if (!collector?.cooperativeId || collector.status === "INACTIVE") return reply.forbidden("Catador indisponível.");
      scope = { cooperativeId: collector.cooperativeId, OR: [{ collectorIds: { has: collector.id } }, { collections: { some: { collectorId: collector.id } } }] };
    } else if (request.user.role === "DRIVER") {
      const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true, cooperativeId: true, status: true } });
      if (!driver || driver.status === "INACTIVE") return reply.forbidden("Motorista indisponível.");
      scope = { cooperativeId: driver.cooperativeId, driverId: driver.id };
    } else return reply.forbidden("Consulta disponível apenas para a equipe de campo.");
    const { view, page, limit } = q.data;
    const where: Prisma.RouteWhereInput = { AND: [scope, { status: { in: view === "active" ? ["SCHEDULED", "IN_PROGRESS"] : ["COMPLETED", "CANCELLED"] } }] };
    const [routes, total] = await prisma.$transaction([
      prisma.route.findMany({ where, select: { id: true, name: true, status: true, scheduledDate: true, startedAt: true, closedAt: true, closureOutcome: true, revision: true },
        orderBy: view === "active" ? [{ scheduledDate: { sort: "asc", nulls: "last" } }, { id: "asc" }] : [{ scheduledDate: { sort: "desc", nulls: "last" } }, { id: "desc" }],
        skip: (page - 1) * limit, take: limit }),
      prisma.route.count({ where }),
    ]);
    return { routes, pagination: { page, limit, total, hasMore: page * limit < total } };
  });
}
