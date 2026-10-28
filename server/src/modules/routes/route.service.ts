import { snapshotRouteTeam } from "../collector-teams/team.service";
import {
  addPlannedPoints,
  validatePoints,
  validateTeam,
  checkConflict,
  notifyRoute,
  dayDate,
  localDay,
} from "./planning.service";
import {
  CollectionStatus,
  Prisma,
  RouteStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  CreateRouteInput,
  UpdateRouteAssignmentsInput,
  UpdateRouteStatusInput,
} from "./route.schemas";

const routeInclude = {
  driver: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      cnh: true,
      cnhCategory: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      plate: true,
      model: true,
      brand: true,
      year: true,
      capacityKg: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  cooperative: {
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      email: true,
      phone: true,
      address: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const collectionInclude = {
  participants: true,
  bin: {
    select: {
      id: true,
      binId: true,
      name: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
    },
  },
  collectionMaterials: {
    select: { id: true, nameSnapshot: true, quantity: true, unit: true },
  },
  collector: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      rg: true,
      birthDate: true,
      status: true,
      kgMonth: true,
      collectionsToday: true,
      totalKg: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      cnh: true,
      cnhCategory: true,
      status: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      plate: true,
      model: true,
      brand: true,
      year: true,
      capacityKg: true,
      status: true,
    },
  },
  generator: {
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      phone: true,
      zipCode: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      address: true,
      latitude: true,
      longitude: true,
      type: true,
      accessReleased: true,
      accessStatus: true,
      totalKg: true,
    },
  },
  schedule: {
    select: {
      pickupAddress: true,
      pickupLatitude: true,
      pickupLongitude: true,
      id: true,
      preferredDate: true,
      scheduledDate: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

function normalizeDate(date?: string | null) {
  if (!date) return null;

  const [day, month, year] = date.split("/");

  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    12,
    0,
    0,
  );

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== Number(year) ||
    parsedDate.getMonth() !== Number(month) - 1 ||
    parsedDate.getDate() !== Number(day)
  ) {
    throw new Error("Data inválida.");
  }

  return parsedDate;
}

const fieldPendingStatuses: CollectionStatus[] = [
  CollectionStatus.PENDING,
  CollectionStatus.IN_PROGRESS,
];
const fieldFinishedStatuses: CollectionStatus[] = [
  CollectionStatus.COLLECTED,
  CollectionStatus.RECEIVED,
  CollectionStatus.SORTING,
  CollectionStatus.COMPLETED,
];

function buildRouteStats(
  collections: Array<{
    status: CollectionStatus;
    cancellationReason?: string | null;
  }>,
) {
  const archivedCollections = collections.filter(
    (c) => c.cancellationReason === "Substituída por revisão do roteiro fixo",
  ).length;
  collections = collections.filter(
    (c) => c.cancellationReason !== "Substituída por revisão do roteiro fixo",
  );
  return {
    archivedCollections,
    totalCollections: collections.length,
    pendingCollections: collections.filter(
      (item) => item.status === CollectionStatus.PENDING,
    ).length,
    inProgressCollections: collections.filter(
      (item) => item.status === CollectionStatus.IN_PROGRESS,
    ).length,
    collectedCollections: collections.filter(
      (item) => item.status === CollectionStatus.COLLECTED,
    ).length,
    receivedCollections: collections.filter(
      (item) => item.status === CollectionStatus.RECEIVED,
    ).length,
    sortingCollections: collections.filter(
      (item) => item.status === CollectionStatus.SORTING,
    ).length,
    fieldCompletedCollections: collections.filter((item) =>
      fieldFinishedStatuses.includes(item.status),
    ).length,
    completedCollections: collections.filter(
      (item) => item.status === CollectionStatus.COMPLETED,
    ).length,
    cancelledCollections: collections.filter(
      (item) => item.status === CollectionStatus.CANCELLED,
    ).length,
  };
}

async function validateResources(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  driverId?: string | null,
  vehicleId?: string | null,
) {
  if (driverId) {
    const driver = await tx.driver.findFirst({
      where: { id: driverId, cooperativeId },
    });
    if (!driver)
      throw new Error("Motorista não encontrado para esta cooperativa.");
    if (driver.status === "INACTIVE")
      throw new Error("O motorista selecionado está inativo.");
  }
  if (vehicleId) {
    const vehicle = await tx.vehicle.findFirst({
      where: { id: vehicleId, cooperativeId },
    });
    if (!vehicle)
      throw new Error("Veículo não encontrado para esta cooperativa.");
    if (vehicle.status !== "ACTIVE")
      throw new Error("Selecione um veículo ativo, fora de manutenção.");
    if (driverId && vehicle.driverId && vehicle.driverId !== driverId)
      throw new Error("Este veículo já está vinculado a outro motorista.");
  }
}

async function syncCollections(
  tx: Prisma.TransactionClient,
  route: {
    id: string;
    cooperativeId: string;
    driverId: string | null;
    vehicleId: string | null;
  },
  ids: string[],
) {
  const current = await tx.collection.findMany({
    where: { routeId: route.id, cooperativeId: route.cooperativeId },
    select: { id: true, status: true },
  });
  const removed = current.filter((c) => !ids.includes(c.id));
  if (removed.some((c) => !fieldPendingStatuses.includes(c.status)))
    throw new Error(
      "Preserve as coletas finalizadas ou canceladas no histórico da rota.",
    );
  const wanted = await tx.collection.findMany({
    where: { id: { in: ids }, cooperativeId: route.cooperativeId },
    select: { id: true, status: true, routeId: true },
  });
  if (
    wanted.length !== ids.length ||
    wanted.some((c) => c.routeId && c.routeId !== route.id)
  )
    throw new Error(
      "Uma coleta não está mais disponível ou não pertence à cooperativa. Atualize a lista.",
    );
  const added = wanted.filter((c) => c.routeId !== route.id);
  if (added.some((c) => !fieldPendingStatuses.includes(c.status)))
    throw new Error(
      "Somente coletas pendentes ou em andamento podem ser adicionadas.",
    );
  if (removed.length)
    await tx.collection.updateMany({
      where: {
        id: { in: removed.map((c) => c.id) },
        routeId: route.id,
        cooperativeId: route.cooperativeId,
        status: { in: fieldPendingStatuses },
      },
      data: { routeId: null, driverId: null, vehicleId: null },
    });
  if (added.length) {
    const claimed = await tx.collection.updateMany({
      where: {
        id: { in: added.map((c) => c.id) },
        routeId: null,
        cooperativeId: route.cooperativeId,
        status: { in: fieldPendingStatuses },
      },
      data: {
        routeId: route.id,
        driverId: route.driverId,
        vehicleId: route.vehicleId,
      },
    });
    if (claimed.count !== added.length)
      throw new Error(
        "Uma coleta acabou de ser vinculada a outra rota. Atualize a lista.",
      );
  }
  await tx.route.update({
    where: { id: route.id },
    data: { collectionOrder: ids },
  });
}

function orderedCollections<T extends { id: string }>(
  collections: T[],
  order: string[],
) {
  const index = new Map(order.map((id, i) => [id, i]));
  return [...collections].sort(
    (a, b) =>
      (index.get(a.id) ?? order.length) - (index.get(b.id) ?? order.length),
  );
}

async function applyVisitOrder(
  tx: Prisma.TransactionClient,
  routeId: string,
  order: string[] | undefined,
  pairs: string[][],
) {
  if (!order) return;
  const mapped = new Map(pairs.map((p) => [p[0], p[1]]));
  const ids = order.map((id) => mapped.get(id) || id);
  const collections = await tx.collection.findMany({
    where: { routeId },
    select: { id: true },
  });
  if (
    ids.length !== collections.length ||
    new Set(ids).size !== ids.length ||
    collections.some((c) => !ids.includes(c.id))
  )
    throw Error("A sequência deve conter todas as visitas uma única vez.");
  await tx.route.update({
    where: { id: routeId },
    data: { collectionOrder: ids },
  });
}
export class RouteService {
  async create(cooperativeUserId: string, data: CreateRouteInput) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });
    if (!cooperative)
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    if (data.status && data.status !== "SCHEDULED")
      throw new Error(
        "Crie a rota como Agendada. Inicie ou encerre a operação pelas ações da rota.",
      );
    let date = normalizeDate(data.scheduledDate);
    if (date && data.departureTime)
      date = dayDate(localDay(date), data.departureTime);
    const id = await prisma.$transaction(
      async (tx) => {
        await validateResources(
          tx,
          cooperative.id,
          data.driverId,
          data.vehicleId,
        );
        await validateTeam(tx, cooperative.id, {
          ...data,
          collectorIds: data.collectorIds || [],
        });
        const route = await tx.route.create({
          data: {
            cooperativeId: cooperative.id,
            collectorIds: data.collectorIds || [],
            teamId: data.teamId,
            startPoint: data.startPoint,
            endPoint: data.endPoint,
            departureTime: data.departureTime,
            estimatedMinutes: data.estimatedMinutes,
            name: data.name.trim(),
            description: data.description?.trim() || null,
            driverId: data.driverId || null,
            vehicleId: data.vehicleId || null,
            scheduledDate: date,
            stops: data.stops.map((s) => s.trim()).filter(Boolean),
            status: "SCHEDULED",
          },
        });
        if (data.collectionIds)
          await syncCollections(tx, route, data.collectionIds);
        const ids = await addPlannedPoints(
          tx,
          route,
          data.plannedPoints || [],
          cooperativeUserId,
        );
        if (ids.length)
          await tx.route.update({
            where: { id: route.id },
            data: { collectionOrder: [...(data.collectionIds || []), ...ids] },
          });
        await applyVisitOrder(
          tx,
          route.id,
          data.visitOrder,
          data.plannedPoints?.map((p, i) => [p.key, ids[i]]) || [],
        );
        await snapshotRouteTeam(tx, route.id);
        if (data.departureTime) await checkConflict(tx, route);
        await notifyRoute(tx, route.id, "Nova execução atribuída à equipe.");
        return route.id;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
      },
    );
    return this.findById(cooperativeUserId, UserRole.COOPERATIVE, id);
  }

  async addCollectionToRoute(
    cooperativeUserId: string,
    routeId: string,
    collectionId: string,
  ) {
    return this.changeCollectionRoute(
      cooperativeUserId,
      routeId,
      collectionId,
      false,
    );
  }

  async removeCollectionFromRoute(
    cooperativeUserId: string,
    routeId: string,
    collectionId: string,
  ) {
    return this.changeCollectionRoute(
      cooperativeUserId,
      routeId,
      collectionId,
      true,
    );
  }

  private async changeCollectionRoute(
    cooperativeUserId: string,
    routeId: string,
    collectionId: string,
    remove: boolean,
  ) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });
    if (!cooperative)
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    return prisma.$transaction(
      async (transaction) => {
        const route = await transaction.route.findFirst({
          where: { id: routeId, cooperativeId: cooperative.id },
        });
        if (!route) throw new Error("Rota não encontrada.");
        if (
          route.status === RouteStatus.COMPLETED ||
          route.status === RouteStatus.CANCELLED
        ) {
          throw new Error(
            "Não é possível alterar coletas de uma rota encerrada.",
          );
        }
        const collection = await transaction.collection.findFirst({
          where: { id: collectionId, cooperativeId: cooperative.id },
        });
        if (!collection || (remove && collection.routeId !== route.id))
          throw new Error("Coleta não encontrada nesta rota ou cooperativa.");
        if (!fieldPendingStatuses.includes(collection.status)) {
          throw new Error(
            "Somente coletas pendentes ou em andamento podem ter o vínculo com a rota alterado. O histórico da coleta finalizada é preservado.",
          );
        }
        if (!remove && collection.routeId && collection.routeId !== route.id) {
          throw new Error("Esta coleta já está vinculada a outra rota.");
        }
        const updated = await transaction.collection.update({
          where: { id: collection.id },
          data: {
            routeId: remove ? null : route.id,
            driverId: remove ? null : route.driverId,
            vehicleId: remove ? null : route.vehicleId,
          },
          include: {
            ...collectionInclude,
            route: {
              select: {
                id: true,
                name: true,
                description: true,
                scheduledDate: true,
                status: true,
              },
            },
          },
        });
        const current = await transaction.collection.findMany({
          where: { routeId: route.id, cooperativeId: cooperative.id },
          select: { id: true },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        const remaining = new Set(current.map((c) => c.id));
        const order = [
          ...route.collectionOrder.filter((id) => remaining.has(id)),
          ...current
            .map((c) => c.id)
            .filter((id) => !route.collectionOrder.includes(id)),
        ];
        await transaction.route.update({
          where: { id: route.id },
          data: { collectionOrder: order },
        });
        await snapshotRouteTeam(transaction, route.id);
        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
      },
    );
  }

  async listAvailableCollectionsForRoute(cooperativeUserId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    return prisma.collection.findMany({
      where: {
        cooperativeId: cooperative.id,
        routeId: null,
        status: {
          in: [CollectionStatus.PENDING, CollectionStatus.IN_PROGRESS],
        },
      },
      include: collectionInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async updateAssignments(
    cooperativeUserId: string,
    routeId: string,
    data: UpdateRouteAssignmentsInput,
    actor?: { sub: string; role: string },
  ) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });
    if (!cooperative)
      throw new Error("Cooperativa do usuário autenticado não encontrada.");

    await prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "Route" WHERE id=${routeId} FOR UPDATE`;
        const route = await transaction.route.findFirst({
          where: { id: routeId, cooperativeId: cooperative.id },
        });
        if (!route) throw new Error("Rota não encontrada.");
        if (actor) {
          if (actor.role === "DRIVER") {
            const driver = await transaction.driver.findFirst({
              where: {
                id: route.driverId || "",
                userId: actor.sub,
                status: { not: "INACTIVE" },
              },
            });
            if (!driver)
              throw Error("Esta execução não está atribuída ao motorista.");
          } else if (actor.role === "COLLECTOR") {
            const collector = await transaction.collector.findFirst({
              where: {
                userId: actor.sub,
                cooperativeId: cooperative.id,
                status: { not: "INACTIVE" },
              },
            });
            if (
              !collector ||
              (!route.collectorIds.includes(collector.id) &&
                !(await transaction.collection.count({
                  where: { routeId: route.id, collectorId: collector.id },
                })))
            )
              throw Error("Esta execução não está atribuída ao catador.");
          } else throw Error("Sem permissão para iniciar esta execução.");
        }
        if (
          data.expectedRevision !== undefined &&
          data.expectedRevision !== route.revision
        )
          throw Error("A execução foi alterada. Recarregue antes de salvar.");
        if (
          route.status === "IN_PROGRESS" &&
          ((data.driverId !== undefined && data.driverId !== route.driverId) ||
            (data.vehicleId !== undefined &&
              data.vehicleId !== route.vehicleId) ||
            (data.collectorIds !== undefined &&
              JSON.stringify(data.collectorIds) !==
                JSON.stringify(route.collectorIds)))
        )
          throw Error("Altere a equipe antes de iniciar a execução.");
        const collectorIds = data.collectorIds ?? route.collectorIds;
        const teamId = data.teamId === undefined ? route.teamId : data.teamId;
        if (route.status === "IN_PROGRESS" && teamId !== route.teamId) throw Error("Altere a equipe antes de iniciar a execução.");
        await validateTeam(transaction, cooperative.id, {
          driverId: data.driverId ?? route.driverId,
          vehicleId: data.vehicleId ?? route.vehicleId,
          collectorIds,
          teamId: data.teamId !== undefined || data.collectorIds !== undefined ? teamId : undefined,
        });
        const driverId =
          data.driverId === undefined ? route.driverId : data.driverId;
        const vehicleId =
          data.vehicleId === undefined ? route.vehicleId : data.vehicleId;
        if (
          [RouteStatus.COMPLETED, RouteStatus.CANCELLED].includes(
            route.status as any,
          )
        )
          throw new Error(
            "A rota está encerrada. Seu planejamento e histórico são somente leitura.",
          );
        if (
          data.driverId !== undefined ||
          data.vehicleId !== undefined ||
          data.collectionIds !== undefined ||
          data.status === "IN_PROGRESS"
        )
          await validateResources(
            transaction,
            cooperative.id,
            driverId,
            vehicleId,
          );
        const scheduledDate =
          data.scheduledDate === undefined
            ? route.scheduledDate
            : normalizeDate(data.scheduledDate);
        if (data.collectionIds)
          await syncCollections(
            transaction,
            { ...route, driverId, vehicleId },
            data.collectionIds,
          );
        for (const update of data.pointUpdates || []) {
          if (route.status !== "SCHEDULED")
            throw Error(
              "Edite os dados dos pontos antes de iniciar a execução.",
            );
          const c = await transaction.collection.findFirst({
            where: {
              id: update.collectionId,
              routeId: route.id,
              status: "PENDING",
            },
          });
          if (!c || !c.routePointKey || c.routePointKey !== update.point.key)
            throw Error("Ponto já iniciado ou não pertence à execução.");
          await validatePoints(
            transaction,
            cooperative.id,
            [update.point],
            collectorIds,
          );
          await transaction.collection.update({
            where: { id: c.id },
            data: {
              routePoint: {
                ...update.point,
                fromPlan: (c.routePoint as any)?.fromPlan === true,
              },
              generatorId:
                update.point.kind === "GENERATOR"
                  ? update.point.sourceId
                  : null,
              binId: update.point.kind === "PEV" ? update.point.sourceId : null,
              collectorId: update.point.collectorId || collectorIds[0],
              notes: update.point.notes,
            },
          });
          if (c.scheduleId)
            await transaction.schedule.update({
              where: { id: c.scheduleId },
              data: {
                generatorId:
                  update.point.kind === "GENERATOR"
                    ? update.point.sourceId
                    : null,
                pickupAddress: update.point.address,
                pickupLatitude: update.point.latitude,
                pickupLongitude: update.point.longitude,
                notes: update.point.notes,
              },
            });
        }
        if (data.plannedPoints?.length) {
          const ids = await addPlannedPoints(
            transaction,
            { ...route, driverId, vehicleId, collectorIds, scheduledDate },
            data.plannedPoints,
            cooperativeUserId,
          );
          const current = await transaction.route.findUniqueOrThrow({
            where: { id: route.id },
          });
          await transaction.route.update({
            where: { id: route.id },
            data: { collectionOrder: [...current.collectionOrder, ...ids] },
          });
          await applyVisitOrder(
            transaction,
            route.id,
            data.visitOrder,
            data.plannedPoints.map((p, i) => [p.key, ids[i]]),
          );
        }
        if (!data.plannedPoints?.length)
          await applyVisitOrder(transaction, route.id, data.visitOrder, []);
        if (data.status === "SCHEDULED" && route.status !== "SCHEDULED")
          throw Error("Uma execução iniciada não pode voltar para Agendada.");
        if (data.status === "IN_PROGRESS" && route.status !== "IN_PROGRESS") {
          const count = await transaction.collection.count({
            where: {
              routeId: route.id,
              cooperativeId: cooperative.id,
              status: { in: fieldPendingStatuses },
            },
          });
          if (!driverId || !vehicleId || !scheduledDate || !count)
            throw new Error(
              actor
                ? "A rota aguarda preparação pela cooperativa. Solicite a definição da data, do motorista e do veículo, com ao menos uma coleta pendente ou em andamento. Atualize a rota após a liberação."
                : "Para iniciar, defina data, motorista, veículo e ao menos uma coleta pendente/em andamento.",
            );
        }
        if (
          data.status === RouteStatus.COMPLETED &&
          route.status !== RouteStatus.COMPLETED
        ) {
          const collections = await transaction.collection.findMany({
            where: { routeId: route.id, cooperativeId: cooperative.id },
            select: { status: true },
          });
          if (
            collections.some((item) =>
              fieldPendingStatuses.includes(item.status),
            )
          ) {
            throw new Error(
              "Finalize ou cancele as coletas pendentes/em andamento antes de concluir a rota.",
            );
          }
          if (!collections.length) {
            throw new Error(
              "Para concluir a rota, finalize ao menos uma coleta em campo.",
            );
          }
        }
        // Mantém a regra de cancelamento existente até a definição do ciclo operacional.
        if (data.status === RouteStatus.CANCELLED) {
          const activeCount = await transaction.collection.count({
            where: {
              routeId: route.id,
              status: {
                notIn: [CollectionStatus.COMPLETED, CollectionStatus.CANCELLED],
              },
            },
          });
          if (activeCount > 0)
            throw new Error(
              "Não é possível cancelar uma rota com coletas operacionais ativas.",
            );
        }
        await transaction.route.update({
          where: { id: route.id },
          data: {
            driverId: data.driverId,
            vehicleId: data.vehicleId,
            collectorIds: data.collectorIds,
            teamId: data.teamId,
            startPoint: data.startPoint,
            endPoint: data.endPoint,
            departureTime: data.departureTime,
            estimatedMinutes: data.estimatedMinutes,
            revision: { increment: 1 },
            name: data.name?.trim(),
            description:
              data.description === undefined
                ? undefined
                : data.description?.trim() || null,
            scheduledDate:
              data.scheduledDate === undefined
                ? data.departureTime && route.scheduledDate
                  ? dayDate(localDay(route.scheduledDate), data.departureTime)
                  : undefined
                : data.scheduledDate &&
                    (data.departureTime || route.departureTime)
                  ? dayDate(
                      localDay(normalizeDate(data.scheduledDate)!),
                      data.departureTime || route.departureTime!,
                    )
                  : normalizeDate(data.scheduledDate),
            stops: data.stops?.map((stop) => stop.trim()).filter(Boolean),
            status: data.status,
          },
        });
        await snapshotRouteTeam(transaction, route.id);
        const updated = await transaction.route.findUniqueOrThrow({
          where: { id: route.id },
        });
        if (updated.departureTime && !data.status)
          await checkConflict(transaction, updated);
        if (data.collectorIds) {
          const removed = route.collectorIds.filter(
            (id) => !data.collectorIds!.includes(id),
          );
          if (removed.length)
            await transaction.collection.updateMany({
              where: {
                routeId: route.id,
                status: "PENDING",
                collectorId: { in: removed },
              },
              data: { collectorId: data.collectorIds[0] || null },
            });
        }
        if (
          data.scheduledDate !== undefined ||
          data.departureTime !== undefined
        ) {
          const ids = await transaction.collection.findMany({
            where: {
              routeId: route.id,
              status: "PENDING",
              scheduleId: { not: null },
            },
            select: { scheduleId: true },
          });
          await transaction.schedule.updateMany({
            where: { id: { in: ids.map((c) => c.scheduleId!) } },
            data: { scheduledDate: updated.scheduledDate },
          });
        }
        await notifyRoute(
          transaction,
          route.id,
          "Confira a programação e a sequência de visitas.",
        );
        if (driverId !== route.driverId || vehicleId !== route.vehicleId) {
          await transaction.collection.updateMany({
            where: {
              routeId: route.id,
              cooperativeId: cooperative.id,
              status: {
                in: [CollectionStatus.PENDING, CollectionStatus.IN_PROGRESS],
              },
            },
            data: { driverId, vehicleId },
          });
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
      },
    );

    return this.findById(cooperativeUserId, UserRole.COOPERATIVE, routeId);
  }

  async listByAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const routes = await prisma.route.findMany({
      where: { cooperativeId: cooperative.id },
      include: routeInclude,
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    });

    const routeIds = routes.map((route) => route.id);

    const collections = routeIds.length
      ? await prisma.collection.findMany({
          where: {
            routeId: { in: routeIds },
          },
          select: {
            id: true,
            routeId: true,
            cancellationReason: true,
            status: true,
            collectedAt: true,
            collectorId: true,
            generatorId: true,
            createdAt: true,
          },
        })
      : [];

    return routes.map((route) => {
      const routeCollections = collections.filter(
        (collection) => collection.routeId === route.id,
      );

      return {
        ...route,
        stats: buildRouteStats(routeCollections),
      };
    });
  }

  async listByAuthenticatedCollector(userId: string) {
    const collector = await prisma.collector.findUnique({ where: { userId } });
    if (!collector || collector.status === "INACTIVE")
      throw Error("Catador indisponível.");
    return prisma.route.findMany({
      where: {
        cooperativeId: collector.cooperativeId || "",
        OR: [
          { collectorIds: { has: collector.id } },
          { collections: { some: { collectorId: collector.id } } },
        ],
      },
      include: routeInclude,
      orderBy: { scheduledDate: "asc" },
    });
  }

  async listByAuthenticatedDriver(driverUserId: string) {
    const driver = await prisma.driver.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver) {
      throw new Error("Motorista do usuário autenticado não encontrado.");
    }

    const routes = await prisma.route.findMany({
      where: {
        driverId: driver.id,
      },
      include: routeInclude,
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    });

    const routeIds = routes.map((route) => route.id);

    const collections = routeIds.length
      ? await prisma.collection.findMany({
          where: {
            routeId: { in: routeIds },
          },
          select: {
            id: true,
            routeId: true,
            cancellationReason: true,
            status: true,
            collectedAt: true,
            collectorId: true,
            generatorId: true,
            createdAt: true,
          },
        })
      : [];

    return routes.map((route) => {
      const routeCollections = collections.filter(
        (collection) => collection.routeId === route.id,
      );

      return {
        ...route,
        stats: buildRouteStats(routeCollections),
      };
    });
  }

  async findById(authUserId: string, authUserRole: string, routeId: string) {
    let routeWhere: { id: string; cooperativeId?: string; driverId?: string } =
      {
        id: routeId,
      };

    if (authUserRole === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
      });

      if (!cooperative) {
        throw new Error("Cooperativa do usuário autenticado não encontrada.");
      }

      routeWhere.cooperativeId = cooperative.id;
    } else if (authUserRole === UserRole.DRIVER) {
      const driver = await prisma.driver.findUnique({
        where: { userId: authUserId },
      });

      if (!driver) {
        throw new Error("Motorista do usuário autenticado não encontrado.");
      }

      if (driver.status === "INACTIVE") throw Error("Motorista inativo.");
      routeWhere.driverId = driver.id;
    } else if (authUserRole === UserRole.COLLECTOR) {
      const collector = await prisma.collector.findUnique({
        where: { userId: authUserId },
      });
      if (!collector || collector.status === "INACTIVE")
        throw Error("Catador indisponível.");
      const allowed = await prisma.route.findFirst({
        where: {
          id: routeId,
          cooperativeId: collector.cooperativeId || "",
          OR: [
            { collectorIds: { has: collector.id } },
            { collections: { some: { collectorId: collector.id } } },
          ],
        },
      });
      if (!allowed) throw Error("Rota não atribuída ao catador.");
      routeWhere.cooperativeId = collector.cooperativeId!;
    } else {
      throw new Error("Usuário sem permissão para consultar rota.");
    }

    const route = await prisma.route.findFirst({
      where: routeWhere,
      include: routeInclude,
    });

    if (!route) {
      throw new Error("Rota não encontrada.");
    }

    const collections = orderedCollections(
      await prisma.collection.findMany({
        where: { routeId: route.id },
        include: collectionInclude,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      route.collectionOrder,
    );

    const activeCollections = collections.filter((item) =>
      fieldPendingStatuses.includes(item.status),
    );

    return {
      ...route,
      collections,
      activeCollections,
      stats: buildRouteStats(collections),
    };
  }

  async updateStatus(
    cooperativeUserId: string,
    routeId: string,
    data: UpdateRouteStatusInput,
    actor?: { sub: string; role: string },
  ) {
    return this.updateAssignments(cooperativeUserId, routeId, data, actor);
  }
}
