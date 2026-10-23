import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
export async function inboxRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.get("/notifications", async (request, reply) => {
    const parsed = z
      .object({
        cursor: z.string().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(30),
      })
      .safeParse(request.query);
    if (!parsed.success) return reply.badRequest("Paginação inválida.");
    const { cursor, limit } = parsed.data;
    const userId = request.user.sub;
    if (
      cursor &&
      !(await prisma.inboxNotification.findFirst({
        where: { id: cursor, userId },
        select: { id: true },
      }))
    )
      return reply.badRequest("Página inválida.");
    const [rows, unreadCount] = await Promise.all([
      prisma.inboxNotification.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.inboxNotification.count({ where: { userId, readAt: null } }),
    ]);
    const hasMore = rows.length > limit;
    const notifications = rows.slice(0, limit);
    return {
      userId,
      notifications,
      unreadCount,
      nextCursor: hasMore ? notifications[notifications.length - 1].id : null,
    };
  });
  app.patch("/notifications/:id/read", async (request, reply) => {
    const params = z
      .object({ id: z.string().min(1).max(100) })
      .parse(request.params);
    const result = await prisma.inboxNotification.updateMany({
      where: { id: params.id, userId: request.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    if (
      !result.count &&
      !(await prisma.inboxNotification.findFirst({
        where: { id: params.id, userId: request.user.sub },
        select: { id: true },
      }))
    )
      return reply.notFound("Aviso não encontrado.");
    return { success: true };
  });
  app.post("/notifications/read-all", async (request) => {
    // O instante delimita a leitura; avisos posteriores permanecem não lidos.
    const now = new Date();
    await prisma.inboxNotification.updateMany({
      where: {
        userId: request.user.sub,
        readAt: null,
        createdAt: { lte: now },
      },
      data: { readAt: now },
    });
    return { success: true };
  });
}
