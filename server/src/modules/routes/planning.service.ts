import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { notifyCollection } from "../inbox/inbox.service";
import { PlanInput, RoutePoint } from "./planning.schemas";
export const localDay = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const dayDate = (day: string, time = "08:00") =>
  new Date(`${day}T${time}:00-03:00`);
export function daysAhead(start: string, count: number) {
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(start + "T12:00:00Z") + i * 86400000)
      .toISOString()
      .slice(0, 10),
  );
}
export function runsOn(
  plan: {
    startsOn: string;
    endsOn?: string | null;
    weekdays: number[];
    intervalWeeks: number;
    exceptions: string[];
  },
  day: string,
) {
  const d = new Date(day + "T12:00:00Z"),
    a = new Date(plan.startsOn + "T12:00:00Z");
  const monday = (x: Date) =>
    Date.UTC(
      x.getUTCFullYear(),
      x.getUTCMonth(),
      x.getUTCDate() - ((x.getUTCDay() + 6) % 7),
    );
  return (
    day >= plan.startsOn &&
    (!plan.endsOn || day <= plan.endsOn) &&
    plan.weekdays.includes(d.getUTCDay()) &&
    !plan.exceptions.includes(day) &&
    Math.round((monday(d) - monday(a)) / 604800000) % plan.intervalWeeks === 0
  );
}
export async function validateTeam(
  tx: Prisma.TransactionClient,
  coopId: string,
  data: {
    driverId?: string | null;
    vehicleId?: string | null;
    collectorIds: string[];
  },
) {
  if (new Set(data.collectorIds).size !== data.collectorIds.length)
    throw Error("Não repita catadores na equipe.");
  const collectors = await tx.collector.count({
    where: {
      id: { in: data.collectorIds },
      cooperativeId: coopId,
      status: { not: "INACTIVE" },
    },
  });
  if (collectors !== data.collectorIds.length)
    throw Error("Há catador inativo ou de outra cooperativa na equipe.");
  if (data.driverId) {
    const d = await tx.driver.findFirst({
      where: {
        id: data.driverId,
        cooperativeId: coopId,
        status: { not: "INACTIVE" },
      },
    });
    if (!d) throw Error("Motorista indisponível.");
  }
  if (data.vehicleId) {
    const v = await tx.vehicle.findFirst({
      where: { id: data.vehicleId, cooperativeId: coopId, status: "ACTIVE" },
    });
    if (!v) throw Error("Veículo indisponível.");
    if (data.driverId && v.driverId && v.driverId !== data.driverId)
      throw Error("O veículo está vinculado a outro motorista.");
  }
}
export async function validatePoints(
  tx: Prisma.TransactionClient,
  coopId: string,
  points: RoutePoint[],
  team: string[],
) {
  for (const p of points) {
    if (p.collectorId && !team.includes(p.collectorId))
      throw Error("O responsável pelo ponto deve fazer parte da equipe.");
    if (
      p.kind === "GENERATOR" &&
      !(await tx.generator.findFirst({
        where: { id: p.sourceId, cooperativeId: coopId },
      }))
    )
      throw Error("Gerador não pertence à cooperativa.");
    if (
      p.kind === "PEV" &&
      !(await tx.bin.findFirst({
        where: {
          id: p.sourceId,
          cooperativeId: coopId,
          status: { notIn: ["INACTIVE", "MAINTENANCE"] },
        },
      }))
    )
      throw Error("PEV indisponível ou de outra cooperativa.");
  }
}
export async function addPlannedPoints(
  tx: Prisma.TransactionClient,
  route: {
    id: string;
    cooperativeId: string;
    driverId: string | null;
    vehicleId: string | null;
    scheduledDate: Date | null;
    collectorIds: string[];
  },
  points: RoutePoint[],
  ownerId: string,
  fromPlan = false,
) {
  await validatePoints(tx, route.cooperativeId, points, route.collectorIds);
  const existing = await tx.collection.findMany({
    where: { routeId: route.id, status: { not: "CANCELLED" } },
    select: { routePointKey: true, routePoint: true },
  });
  if (
    points.some((p) =>
      existing.some(
        (c) =>
          c.routePointKey === p.key ||
          (p.sourceId &&
            (c.routePoint as any)?.kind === p.kind &&
            (c.routePoint as any)?.sourceId === p.sourceId),
      ),
    )
  )
    throw Error("Um dos pontos já faz parte desta execução.");
  if (points.length && !route.collectorIds.length)
    throw Error("Defina ao menos um catador responsável pelos pontos.");
  const ids: string[] = [];
  for (const point of points) {
    const schedule = await tx.schedule.create({
      data: {
        cooperativeId: route.cooperativeId,
        requestedByUserId: ownerId,
        generatorId: point.kind === "GENERATOR" ? point.sourceId : null,
        pickupAddress: point.address,
        pickupLatitude: point.latitude,
        pickupLongitude: point.longitude,
        scheduledDate: route.scheduledDate,
        status: "SCHEDULED",
        notes: [
          point.notes,
          point.materials && "Materiais previstos: " + point.materials,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    const c = await tx.collection.create({
      data: {
        cooperativeId: route.cooperativeId,
        routeId: route.id,
        scheduleId: schedule.id,
        generatorId: point.kind === "GENERATOR" ? point.sourceId : null,
        binId: point.kind === "PEV" ? point.sourceId : null,
        collectorId: point.collectorId || route.collectorIds[0],
        driverId: route.driverId,
        vehicleId: route.vehicleId,
        routePoint: { ...point, fromPlan },
        routePointKey: point.key,
        notes: point.notes,
      },
    });
    ids.push(c.id);
  }
  return ids;
}
export async function notifyRoute(
  tx: Prisma.TransactionClient,
  routeId: string,
  message: string,
) {
  const r = await tx.route.findUniqueOrThrow({ where: { id: routeId } });
  const collectors = await tx.collector.findMany({
    where: { id: { in: r.collectorIds }, cooperativeId: r.cooperativeId },
    select: { userId: true },
  });
  const driver = r.driverId
    ? await tx.driver.findUnique({
        where: { id: r.driverId },
        select: { userId: true },
      })
    : null;
  const ids = [
    ...new Set(
      [...collectors.map((c) => c.userId), driver?.userId].filter(
        (v): v is string => !!v,
      ),
    ),
  ];
  if (ids.length)
    await tx.inboxNotification.createMany({
      data: ids.map((userId) => ({
        userId,
        eventKey: `route:${r.id}:${r.revision}`,
        kind: "ROUTE_UPDATED",
        title: "Rota atualizada",
        message: `${r.name}: ${message}`,
        data: { routeId: r.id },
      })),
      skipDuplicates: true,
    });
}
async function checkConflict(
  tx: Prisma.TransactionClient,
  r: {
    id: string;
    cooperativeId: string;
    driverId: string | null;
    vehicleId: string | null;
    collectorIds: string[];
    scheduledDate: Date | null;
    estimatedMinutes: number | null;
  },
) {
  if (!r.scheduledDate) return;
  const duration = (r.estimatedMinutes || 240) * 60000;
  const others = await tx.route.findMany({
    where: {
      id: { not: r.id },
      cooperativeId: r.cooperativeId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      scheduledDate: {
        gte: new Date(r.scheduledDate.getTime() - 86400000),
        lte: new Date(r.scheduledDate.getTime() + duration),
      },
    },
  });
  if (
    others.some(
      (o) =>
        o.scheduledDate!.getTime() < r.scheduledDate!.getTime() + duration &&
        o.scheduledDate!.getTime() + (o.estimatedMinutes || 240) * 60000 >
          r.scheduledDate!.getTime() &&
        ((r.driverId && r.driverId === o.driverId) ||
          (r.vehicleId && r.vehicleId === o.vehicleId) ||
          r.collectorIds.some((id) => o.collectorIds.includes(id))),
    )
  )
    throw Error("Conflito de horário com outra execução da equipe ou veículo.");
}
export { checkConflict };
export class RoutePlanningService {
  async coop(userId: string) {
    const c = await prisma.cooperative.findUnique({ where: { userId } });
    if (!c) throw Error("Cooperativa não encontrada.");
    return c;
  }
  async list(userId: string) {
    const c = await this.coop(userId);
    return prisma.routePlan.findMany({
      where: { cooperativeId: c.id },
      orderBy: { createdAt: "desc" },
    });
  }
  async save(userId: string, input: PlanInput, id?: string) {
    const coop = await this.coop(userId);
    const result = await prisma.$transaction(
      async (tx) => {
        let old = id
          ? await tx.routePlan.findFirst({
              where: { id, cooperativeId: coop.id },
            })
          : null;
        if (id && !old) throw Error("Roteiro não encontrado.");
        if (old && input.expectedVersion !== old.version)
          throw Error("O roteiro foi alterado. Recarregue antes de salvar.");
        await validateTeam(tx, coop.id, input);
        await validatePoints(tx, coop.id, input.points, input.collectorIds);
        const { expectedVersion, applyToScheduled, ...data } = input;
        const plan = old
          ? await tx.routePlan.update({
              where: { id: old.id },
              data: { ...data, version: { increment: 1 } },
            })
          : await tx.routePlan.create({
              data: { ...data, cooperativeId: coop.id },
            });
        if (applyToScheduled && old) {
          const routes = await tx.route.findMany({
            where: {
              planId: plan.id,
              cooperativeId: coop.id,
              status: "SCHEDULED",
              executionDate: { gte: localDay() },
            },
            include: { collections: true },
          });
          for (const r of routes) {
            if (
              r.collections.some(
                (c) =>
                  c.status !== "PENDING" &&
                  c.cancellationReason !==
                    "Substituída por revisão do roteiro fixo",
              )
            )
              throw Error(
                "Uma execução já possui atividade. Edite essa execução individualmente.",
              );
            // Vinculações avulsas são preservadas; somente pontos originados no roteiro são atualizados.
            const planned = r.collections.filter(
              (c) =>
                c.status === "PENDING" &&
                (c.routePoint as any)?.fromPlan === true,
            );
            const archived = r.collections.filter(
              (c) =>
                c.cancellationReason ===
                  "Substituída por revisão do roteiro fixo" ||
                planned.some((p) => p.id === c.id),
            );
            const dayPoints = (plan.points as RoutePoint[]).filter(
              (p) =>
                !p.weekdays?.length ||
                p.weekdays.includes(
                  new Date(r.executionDate! + "T12:00:00Z").getUTCDay(),
                ),
            );
            for (const c of planned) {
              await tx.collection.update({
                where: { id: c.id },
                data: {
                  status: "CANCELLED",
                  cancellationReason: "Substituída por revisão do roteiro fixo",
                  cancelledAt: new Date(),
                },
              });
              if (c.scheduleId)
                await tx.schedule.update({
                  where: { id: c.scheduleId },
                  data: { status: "CANCELLED" },
                });
            }
            if (
              !runsOn(plan, r.executionDate!) ||
              !plan.active ||
              (!dayPoints.length &&
                !r.collections.some(
                  (c) =>
                    c.status === "PENDING" &&
                    !planned.some((p) => p.id === c.id),
                ))
            ) {
              await tx.collection.updateMany({
                where: { routeId: r.id, status: "PENDING" },
                data: { routeId: null, driverId: null, vehicleId: null },
              });
              await tx.route.update({
                where: { id: r.id },
                data: { status: "CANCELLED", revision: { increment: 1 } },
              });
              await notifyRoute(
                tx,
                r.id,
                "Execução cancelada pela revisão do roteiro.",
              );
              continue;
            }
            const next = await tx.route.update({
              where: { id: r.id },
              data: {
                name: plan.name,
                description: plan.description,
                collectorIds: plan.collectorIds,
                driverId: plan.driverId,
                vehicleId: plan.vehicleId,
                scheduledDate: dayDate(r.executionDate!, plan.departureTime),
                departureTime: plan.departureTime,
                estimatedMinutes: plan.estimatedMinutes,
                startPoint: plan.startPoint as Prisma.InputJsonValue,
                endPoint: plan.endPoint as Prisma.InputJsonValue,
                revision: { increment: 1 },
              },
            });
            await checkConflict(tx, next);
            const ids = await addPlannedPoints(
              tx,
              next,
              dayPoints,
              userId,
              true,
            );
            await tx.collection.updateMany({
              where: { routeId: r.id, status: "PENDING" },
              data: { driverId: next.driverId, vehicleId: next.vehicleId },
            });
            await tx.route.update({
              where: { id: r.id },
              data: {
                collectionOrder: [
                  ...r.collectionOrder.filter(
                    (id) => !archived.some((c) => c.id === id),
                  ),
                  ...ids,
                  ...archived.map((c) => c.id),
                ],
              },
            });
            await notifyRoute(tx, r.id, "Planejamento da execução revisado.");
          }
        }
        return plan;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    );
    await this.generate(result.id);
    return prisma.routePlan.findUniqueOrThrow({ where: { id: result.id } });
  }
  async generate(planId: string) {
    const plan = await prisma.routePlan.findUnique({
      where: { id: planId },
      include: { cooperative: { select: { userId: true } } },
    });
    if (!plan?.active) return;
    const errors: string[] = [];
    for (const day of daysAhead(localDay(), 7)) {
      if (
        !runsOn(plan, day) ||
        dayDate(day, plan.departureTime).getTime() < Date.now()
      )
        continue;
      try {
        await prisma.$transaction(
          async (tx) => {
            const fresh = await tx.routePlan.findUniqueOrThrow({
              where: { id: plan.id },
            });
            if (!fresh.active || fresh.version !== plan.version) return;
            if (
              await tx.route.findUnique({
                where: {
                  planId_executionDate: { planId: plan.id, executionDate: day },
                },
              })
            )
              return;
            const points = (plan.points as RoutePoint[]).filter(
              (p) =>
                !p.weekdays?.length ||
                p.weekdays.includes(new Date(day + "T12:00:00Z").getUTCDay()),
            );
            if (!points.length) return;
            await validateTeam(tx, plan.cooperativeId, plan);
            const route = await tx.route.create({
              data: {
                planId: plan.id,
                executionDate: day,
                cooperativeId: plan.cooperativeId,
                name: plan.name,
                description: plan.description,
                scheduledDate: dayDate(day, plan.departureTime),
                departureTime: plan.departureTime,
                estimatedMinutes: plan.estimatedMinutes,
                driverId: plan.driverId,
                vehicleId: plan.vehicleId,
                collectorIds: plan.collectorIds,
                stops: [],
                startPoint: plan.startPoint as Prisma.InputJsonValue,
                endPoint: plan.endPoint as Prisma.InputJsonValue,
              },
            });
            await checkConflict(tx, route);
            const ids = await addPlannedPoints(
              tx,
              route,
              points,
              plan.cooperative.userId,
              true,
            );
            await tx.route.update({
              where: { id: route.id },
              data: { collectionOrder: ids },
            });
            await notifyRoute(
              tx,
              route.id,
              "Nova execução programada para " +
                day.split("-").reverse().join("/") +
                ".",
            );
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 20000,
          },
        );
      } catch (e: any) {
        if (e.code !== "P2002" && e.code !== "P2034")
          errors.push(
            `${day}: ${e.code ? "Falha ao gerar execução" : e.message}`,
          );
      }
    }
    await prisma.routePlan.update({
      where: { id: plan.id },
      data: {
        lastGeneratedAt: new Date(),
        lastGenerationError: errors.join("\n").slice(0, 2000) || null,
      },
    });
  }
  async occurrence(
    userId: string,
    role: string,
    routeId: string,
    collectionId: string,
    reason: string,
  ) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Route" WHERE id=${routeId} FOR UPDATE`;
        const r = await tx.route.findUniqueOrThrow({
          where: { id: routeId },
          include: { cooperative: true },
        });
        const collector = await tx.collector.findUnique({ where: { userId } });
        const driver = await tx.driver.findUnique({ where: { userId } });
        const owner = role === "COOPERATIVE" && r.cooperative.userId === userId;
        if (
          !owner &&
          !(
            role === "COLLECTOR" &&
            collector?.status !== "INACTIVE" &&
            collector?.cooperativeId === r.cooperativeId &&
            (r.collectorIds.includes(collector.id) ||
              (await tx.collection.count({
                where: { routeId: r.id, collectorId: collector.id },
              })) > 0)
          ) &&
          !(
            role === "DRIVER" &&
            driver?.status !== "INACTIVE" &&
            r.driverId === driver?.id
          )
        )
          throw Error("Sem permissão para esta rota.");
        if (r.status !== "IN_PROGRESS")
          throw Error(
            "Inicie a execução antes de registrar uma visita não realizada.",
          );
        const c = await tx.collection.findFirst({
          where: { id: collectionId, routeId: r.id, status: "PENDING" },
        });
        if (!c)
          throw Error(
            "A coleta já foi iniciada ou encerrada. Atualize a rota.",
          );
        const changed = await tx.collection.updateMany({
          where: { id: c.id, status: "PENDING" },
          data: {
            status: "CANCELLED",
            cancellationReason: reason,
            cancelledAt: new Date(),
            cancelledByUserId: userId,
          },
        });
        if (changed.count !== 1)
          throw Error("Coleta alterada simultaneamente.");
        if (c.scheduleId)
          await tx.schedule.update({
            where: { id: c.scheduleId },
            data: { status: "CANCELLED" },
          });
        await notifyCollection(
          tx,
          c.id,
          `visit:${c.id}`,
          "VISIT_NOT_COMPLETED",
          "Visita não realizada",
          reason,
        );
        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
