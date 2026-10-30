import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
const idSchema = z.object({ id: z.string().min(1).max(100) });
const addressSchema = z.object({
  id: z.string().uuid(), label: z.string().trim().min(1).max(50),
  address: z.string().trim().min(5).max(500),
  latitude: z.number().finite().min(-90).max(90).nullable().default(null),
  longitude: z.number().finite().min(-180).max(180).nullable().default(null),
}).refine(a => (a.latitude === null) === (a.longitude === null), "Informe as duas coordenadas.");
const profileSchema = z.object({
  displayName: z.string().trim().min(3).max(150),
  phone: z.string().transform(s => s.replace(/\D/g, "")).refine(s => /^\d{10,11}$/.test(s), "Informe telefone com DDD."),
  address: z.string().trim().min(5).max(500),
  savedAddresses: z.array(addressSchema).max(10).refine(a => new Set(a.map(x => x.id)).size === a.length, "Endereço repetido."),
}).strict();
const confirmed = ["RECEIVED", "SORTING", "COMPLETED"] as const;
const scheduleSelect = {
  id: true, status: true, createdAt: true, preferredDate: true, scheduledDate: true,
  pickupAddress: true, pickupLatitude: true, pickupLongitude: true, notes: true,
  cooperative: { select: { id: true, name: true, phone: true, email: true, city: true, address: true } },
  requestedMaterials: { select: { id: true, wasteTypeId: true, nameSnapshot: true, categorySnapshot: true, subcategorySnapshot: true, estimatedQuantity: true, unit: true } },
  collections: { select: { id: true, status: true, createdAt: true, startedAt: true, collectedAt: true, receivedAt: true, sortingStartedAt: true, completedAt: true, cancelledAt: true, totalWeightKg: true,
    collectionMaterials: { select: { nameSnapshot: true, quantity: true, reportedQuantity: true, unit: true } } } },
} satisfies Prisma.ScheduleSelect;
function fail(statusCode: number, message: string): never { throw Object.assign(new Error(message), { statusCode }); }
async function owner(request: FastifyRequest) {
  const user = request.user as { sub: string; role: string };
  if (user.role !== "PF") fail(403, "Este recurso é exclusivo do gerador residencial.");
  return user.sub;
}
async function handle(reply: FastifyReply, fn: () => Promise<unknown>) {
  try { return reply.send(await fn()); }
  catch (e: unknown) {
    const error = e as Error & { statusCode?: number };
    return reply.status(e instanceof z.ZodError ? 400 : error.statusCode || 500).send({ message: e instanceof z.ZodError ? e.issues[0].message : error.statusCode ? error.message : "Não foi possível concluir. Tente novamente." });
  }
}
export async function residentialRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.get("/residential/overview", (request, reply) => handle(reply, async () => {
    const userId = await owner(request);
    const own = { requestedByUserId: userId };
    const collected = { schedule: own, status: { in: [...confirmed] } } satisfies Prisma.CollectionWhereInput;
    const [groups, totals, requests, months, profile, lastReceived] = await Promise.all([
      prisma.schedule.groupBy({ by: ["status"], where: own, _count: true }),
      prisma.collection.aggregate({ where: collected, _sum: { totalWeightKg: true }, _count: true }),
      prisma.schedule.findMany({ where: { ...own, status: { in: ["REQUESTED", "SCHEDULED", "IN_PROGRESS"] } }, select: scheduleSelect, orderBy: [{ scheduledDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 5 }),
      prisma.$queryRaw<{ month: string; kg: number; count: bigint }[]>`SELECT to_char(date_trunc('month', COALESCE(c."collectedAt",c."receivedAt",c."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza'),'YYYY-MM') AS month, COALESCE(SUM(c."totalWeightKg"),0)::float AS kg, COUNT(*) AS count FROM "Collection" c JOIN "Schedule" s ON s.id=c."scheduleId" WHERE s."requestedByUserId"=${userId} AND c.status IN ('RECEIVED','SORTING','COMPLETED') AND COALESCE(c."collectedAt",c."receivedAt",c."createdAt") >= ((date_trunc('month',now() AT TIME ZONE 'America/Fortaleza') - interval '5 months') AT TIME ZONE 'America/Fortaleza' AT TIME ZONE 'UTC') GROUP BY month ORDER BY month`,
      prisma.personProfile.findUnique({ where: { userId }, select: { address: true, savedAddresses: true } }),
      prisma.collection.findFirst({ where: collected, select: { scheduleId: true, totalWeightKg: true, collectedAt: true, receivedAt: true }, orderBy: [{ receivedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }] }),
    ]);
    return { lastReceived, counts: Object.fromEntries(groups.map(g => [g.status, g._count])), receivedKg: Number(totals._sum.totalWeightKg || 0), receivedCollections: totals._count, requests, months: months.map(m => ({ ...m, count: Number(m.count) })), profile, updatedAt: new Date().toISOString() };
  }));
  app.get("/residential/submissions/:id", (request, reply) => handle(reply, async () => {
    const userId = await owner(request), { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return { schedule: await prisma.schedule.findFirst({ where: { requestOperationId: id, requestedByUserId: userId }, select: scheduleSelect }) };
  }));
  app.get("/residential/requests/:id", (request, reply) => handle(reply, async () => {
    const userId = await owner(request), { id } = idSchema.parse(request.params);
    const schedule = await prisma.schedule.findFirst({ where: { id, requestedByUserId: userId }, select: scheduleSelect });
    if (!schedule) fail(404, "Solicitação não encontrada.");
    return { schedule };
  }));
  app.post("/residential/requests/:id/cancel", (request, reply) => handle(reply, async () => {
    const userId = await owner(request), { id } = idSchema.parse(request.params);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Schedule" WHERE id=${id} AND "requestedByUserId"=${userId} FOR UPDATE`;
      const schedule = await tx.schedule.findFirst({ where: { id, requestedByUserId: userId }, include: { collections: { select: { id: true } } } });
      if (!schedule) fail(404, "Solicitação não encontrada.");
      if (schedule.status === "CANCELLED") return { cancelled: true };
      if (schedule.status !== "REQUESTED" || schedule.collections.length) fail(409, "A cooperativa já organizou o atendimento. Entre em contato para solicitar alterações.");
      await tx.schedule.update({ where: { id }, data: { status: "CANCELLED" } });
      return { cancelled: true };
    });
  }));
  app.patch("/residential/profile", (request, reply) => handle(reply, async () => {
    const userId = await owner(request), data = profileSchema.parse(request.body);
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: userId }, data: { displayName: data.displayName, phone: data.phone } });
      await tx.personProfile.update({ where: { userId }, data: { address: data.address, savedAddresses: data.savedAddresses } });
    });
    return { success: true };
  }));
}
