import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { checkConflict, dayDate, localDay, notifyRoute, validateTeam } from "./planning.service";
import { notifyCollection } from "../inbox/inbox.service";

const reason = z.string().trim().min(5, "Informe o motivo com ao menos cinco caracteres.").max(1000);
export const resolutionSchema = z.object({
  action: z.enum(["CANCEL_REMAINING", "CLOSE_PARTIAL", "RESCHEDULE", "RESCHEDULE_REMAINING"]),
  reason,
  operationId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00"),
}).strict();
export const reportSchema = z.object({ reason, operationId: z.string().uuid().optional() }).strict();
const pending = (c: { status: string }) => ["PENDING", "IN_PROGRESS"].includes(c.status);
const performed = (c: { status: string }) => ["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"].includes(c.status);
export const eventsOf = (value: unknown): any[] => Array.isArray(value) ? value : [];

async function lockedRoute(tx: Prisma.TransactionClient, routeId: string, userId: string, role: string) {
  await tx.$queryRaw`SELECT id FROM "Route" WHERE id=${routeId} FOR UPDATE`;
  const r = await tx.route.findUniqueOrThrow({ where: { id: routeId }, include: { cooperative: true } });
  let allowed = role === "COOPERATIVE" && r.cooperative.userId === userId;
  if (role === "COLLECTOR") {
    const c = await tx.collector.findFirst({ where: { userId, cooperativeId: r.cooperativeId, status: { not: "INACTIVE" } } });
    allowed = !!c && (r.collectorIds.includes(c.id) || !!await tx.collection.findFirst({ where: { routeId, OR: [{ collectorId: c.id }, { participants: { some: { collectorId: c.id } } }] } }));
  }
  if (role === "DRIVER") allowed = !!await tx.driver.findFirst({ where: { id: r.driverId || "", userId, cooperativeId: r.cooperativeId, status: { not: "INACTIVE" } } });
  if (!allowed) throw Error("Sem permissão para esta execução.");
  return r;
}
async function actorName(tx: Prisma.TransactionClient, userId: string) {
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
  return u.displayName;
}
function replay(events: any[], id: string | undefined, userId: string, payload: unknown) {
  const old = id && events.find(e => e.operationId === id);
  if (old && (old.userId !== userId || !isDeepStrictEqual(old.payload, payload))) throw Error("Identificador já utilizado com outro conteúdo.");
  return old;
}
export class RouteLifecycleService {
  async report(userId: string, role: string, routeId: string, collectionId: string | null, input: z.infer<typeof reportSchema>) {
    return prisma.$transaction(async tx => {
      const r = await lockedRoute(tx, routeId, userId, role), events = eventsOf(r.operationalEvents);
      const payload = { collectionId, reason: input.reason };
      if (replay(events, input.operationId, userId, payload)) return { ok: true };
      if (r.status !== "IN_PROGRESS") throw Error("Esta execução precisa estar em campo para receber relatos.");
      await tx.$queryRaw`SELECT id FROM "Collection" WHERE "routeId"=${routeId} ORDER BY id FOR UPDATE`;
      const collections = await tx.collection.findMany({ where: { routeId, cooperativeId: r.cooperativeId } });
      const c = collectionId ? collections.find(c => c.id === collectionId) : null;
      if (collectionId && (!c || !pending(c))) throw Error("Este ponto já foi coletado ou encerrado. Atualize a rota.");
      if (!collectionId && !collections.some(pending)) throw Error("Não há atendimentos pendentes para relatar.");
      if (!collectionId && collections.filter(pending).some(c => !events.some(e => e.kind === "NOT_SERVED" && e.collectionId === c.id))) throw Error("Registre o motivo em cada ponto não atendido antes de solicitar o encerramento.");
      // Legacy clients without operationId still get a safe retry of the same report.
      if (!input.operationId && events.some(e => e.kind === "NOT_SERVED" && e.collectionId === collectionId && e.userId === userId && e.reason === input.reason)) return { ok: true };
      const event = { id: randomUUID(), kind: collectionId ? "NOT_SERVED" : "CLOSURE_REQUEST", collectionId, reason: input.reason, userId, actorName: await actorName(tx, userId), at: new Date().toISOString(), operationId: input.operationId || null, payload };
      await tx.route.update({ where: { id: routeId }, data: { operationalEvents: [...events, event], revision: { increment: 1 } } });
      await tx.inboxNotification.createMany({ data: [{ userId: r.cooperative.userId, eventKey: `route-report:${event.id}`, kind: "ROUTE_PENDING", title: collectionId ? "Ponto não atendido na rota" : "Encerramento com pendências solicitado", message: `${r.name}: ${input.reason}`, data: { routeId, collectionId } }], skipDuplicates: true });
      return { ok: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  }
  async resolve(userId: string, routeId: string, input: z.infer<typeof resolutionSchema>) {
    return prisma.$transaction(async tx => {
      const r = await lockedRoute(tx, routeId, userId, "COOPERATIVE"), events = eventsOf(r.operationalEvents);
      const old = replay(events, input.operationId, userId, input);
      if (old) return { ok: true, routeId, nextRouteId: old.nextRouteId || null };
      if (["COMPLETED", "CANCELLED"].includes(r.status)) throw Error("Esta execução já foi encerrada.");
      if (input.expectedRevision !== r.revision) throw Error("A execução foi alterada. Atualize os dados antes de confirmar.");
      await tx.$queryRaw`SELECT id FROM "Collection" WHERE "routeId"=${routeId} ORDER BY id FOR UPDATE`;
      const all = await tx.collection.findMany({ where: { routeId, cooperativeId: r.cooperativeId }, include: { schedule: { include: { requestedMaterials: true } }, collectionMaterials: true, collectionWasteEntries: { select: { id: true } }, participants: true } });
      const remaining = all.filter(pending), done = all.filter(performed);
      if (!remaining.length) throw Error("Não há pontos pendentes. Utilize a conclusão normal da rota.");
      if (remaining.some(c => c.collectionWasteEntries.length || c.collectedAt || c.receivedAt || c.totalWeightKg > 0 || (c.reportedTotalWeightKg || 0) > 0 || c.quantityReviewVersion > 0 || c.collectionMaterials.length)) throw Error("Há material ou registro de coleta nos pontos pendentes. Regularize cada atendimento antes de encerrar a execução.");
      let date: Date | null = null;
      const reschedule = ["RESCHEDULE", "RESCHEDULE_REMAINING"].includes(input.action);
      if (reschedule) {
        date = input.date ? dayDate(input.date, input.time) : null;
        if (!date || !Number.isFinite(date.getTime()) || localDay(date) !== input.date || date.getTime() <= Date.now()) throw Error("Informe uma nova data e hora futura válida, no fuso do Ceará.");
      }
      if (input.action === "RESCHEDULE" && (r.status !== "SCHEDULED" || r.startedAt || all.some(c => c.startedAt || performed(c)))) throw Error("A execução já teve atividade. Reagende somente os pontos pendentes em uma nova execução.");
      if (input.action === "CLOSE_PARTIAL" && !done.length) throw Error("Sem coletas realizadas, utilize cancelar execução.");
      let nextRouteId: string | null = null;
      if (input.action === "RESCHEDULE") {
        await validateTeam(tx, r.cooperativeId, r);
        await checkConflict(tx, { ...r, scheduledDate: date });
        await tx.route.update({ where: { id: routeId }, data: { scheduledDate: date, departureTime: input.time } });
        for (const c of remaining) if (c.scheduleId) await tx.schedule.update({ where: { id: c.scheduleId }, data: { scheduledDate: date } });
      } else {
        if (input.action === "RESCHEDULE_REMAINING") {
          // A new execution retains the original execution and each original visit as history.
          await validateTeam(tx, r.cooperativeId, r);
          const next = await tx.route.create({ data: { cooperativeId: r.cooperativeId, name: r.name, description: `Reagendamento dos pontos pendentes da execução ${r.id}. ${input.reason}`, scheduledDate: date, departureTime: input.time, driverId: r.driverId, vehicleId: r.vehicleId, collectorIds: r.collectorIds, teamId: r.teamId, startPoint: r.startPoint ?? Prisma.JsonNull, endPoint: r.endPoint ?? Prisma.JsonNull, estimatedMinutes: r.estimatedMinutes, stops: r.stops, operationalEvents: [{ kind: "ORIGIN", routeId, at: new Date().toISOString(), userId, reason: input.reason }] } });
          nextRouteId = next.id;
          const newIds: string[] = [];
          const order = [...remaining].sort((a, b) => r.collectionOrder.indexOf(a.id) - r.collectionOrder.indexOf(b.id));
          for (const c of order) {
            const s = c.schedule;
            const schedule = await tx.schedule.create({ data: { cooperativeId: r.cooperativeId, requestedByUserId: s?.requestedByUserId || userId, generatorId: c.generatorId, scheduledDate: date, status: "SCHEDULED", pickupAddress: s?.pickupAddress, pickupLatitude: s?.pickupLatitude, pickupLongitude: s?.pickupLongitude, requestedMaterials: { create: (s?.requestedMaterials || []).map(m => ({ wasteTypeId: m.wasteTypeId, nameSnapshot: m.nameSnapshot, categorySnapshot: m.categorySnapshot, subcategorySnapshot: m.subcategorySnapshot, unit: m.unit, estimatedQuantity: m.estimatedQuantity })) }, notes: `Reagendada a partir da coleta ${c.id}. ${s?.notes || ""}` } });
            const copy = await tx.collection.create({ data: { cooperativeId: r.cooperativeId, routeId: next.id, scheduleId: schedule.id, generatorId: c.generatorId, binId: c.binId, collectorId: c.collectorId, driverId: c.driverId, vehicleId: c.vehicleId, teamId: c.teamId, teamNameSnapshot: c.teamNameSnapshot, teamVersion: c.teamVersion, routePoint: c.routePoint ?? Prisma.JsonNull, routePointKey: c.routePointKey, notes: `Reagendamento da coleta ${c.id}. ${c.notes || ""}`, participants: { create: c.participants.map(p => ({ collectorId: p.collectorId, nameSnapshot: p.nameSnapshot })) } } });
            newIds.push(copy.id);
          }
          await tx.route.update({ where: { id: next.id }, data: { collectionOrder: newIds } });
        }
        for (const c of remaining) {
          const report = [...events].reverse().find(e => e.kind === "NOT_SERVED" && e.collectionId === c.id);
          const message = `${nextRouteId ? "Não atendida; reagendada" : "Não atendida"}: ${report?.reason || input.reason}. Decisão da cooperativa: ${input.reason}${nextRouteId ? `. Nova execução: ${nextRouteId}` : ""}`;
          await tx.collection.update({ where: { id: c.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByUserId: userId, cancellationReason: message } });
          if (c.scheduleId) await tx.schedule.update({ where: { id: c.scheduleId }, data: { status: "CANCELLED" } });
          await notifyCollection(tx, c.id, `route-resolution:${input.operationId}:${c.id}`, "VISIT_NOT_COMPLETED", nextRouteId ? "Atendimento reagendado" : "Atendimento não realizado", message);
        }
        await tx.route.update({ where: { id: routeId }, data: { status: done.length ? "COMPLETED" : "CANCELLED", closureOutcome: done.length ? "PARTIAL" : "NOT_PERFORMED", closedAt: new Date() } });
        // Preserve inactivity and other ongoing operations when releasing collectors.
        const collectorIds = [...new Set(remaining.flatMap(c => [c.collectorId, ...c.participants.map(p => p.collectorId)]).filter((id): id is string => !!id))].sort();
        for (const id of collectorIds) {
          await tx.$queryRaw`SELECT id FROM "Collector" WHERE id=${id} FOR UPDATE`;
          const active = await tx.collection.count({ where: { status: "IN_PROGRESS", OR: [{ collectorId: id }, { participants: { some: { collectorId: id } } }] } });
          await tx.collector.updateMany({ where: { id, status: { not: "INACTIVE" } }, data: { status: active ? "ON_ROUTE" : "AVAILABLE" } });
        }
      }
      const event = { id: randomUUID(), kind: input.action, reason: input.reason, operationId: input.operationId, userId, actorName: await actorName(tx, userId), at: new Date().toISOString(), payload: input, previousDate: r.scheduledDate?.toISOString() || null, newDate: date?.toISOString() || null, nextRouteId, preservedCollectionIds: done.map(c => c.id), pendingCollectionIds: remaining.map(c => c.id) };
      await tx.route.update({ where: { id: routeId }, data: { operationalEvents: [...events, event] as Prisma.InputJsonValue, revision: { increment: 1 } } });
      await notifyRoute(tx, routeId, input.action === "RESCHEDULE" ? "Execução reagendada. " + input.reason : `Execução encerrada: ${done.length} coletada(s), ${remaining.length} não atendida(s). ${input.reason}`);
      if (nextRouteId) await notifyRoute(tx, nextRouteId, "Nova execução com os pontos não atendidos da programação anterior.");
      return { ok: true, routeId, nextRouteId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  }
}
