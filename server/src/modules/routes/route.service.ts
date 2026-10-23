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

function buildRouteStats(collections: Array<{ status: CollectionStatus }>) {
  return {
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
    const date = normalizeDate(data.scheduledDate);
    const id = await prisma.$transaction(
      async (tx) => {
        await validateResources(
          tx,
          cooperative.id,
          data.driverId,
          data.vehicleId,
        );
        const route = await tx.route.create({
          data: {
            cooperativeId: cooperative.id,
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
        return route.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
  ) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });
    if (!cooperative)
      throw new Error("Cooperativa do usuário autenticado não encontrada.");

    await prisma.$transaction(
      async (transaction) => {
        const route = await transaction.route.findFirst({
          where: { id: routeId, cooperativeId: cooperative.id },
        });
        if (!route) throw new Error("Rota não encontrada.");
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
              "Para iniciar, defina data, motorista, veículo e ao menos uma coleta pendente/em andamento.",
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
          if (
            !collections.some((item) =>
              fieldFinishedStatuses.includes(item.status),
            )
          ) {
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
            name: data.name?.trim(),
            description:
              data.description === undefined
                ? undefined
                : data.description?.trim() || null,
            scheduledDate:
              data.scheduledDate === undefined
                ? undefined
                : normalizeDate(data.scheduledDate),
            stops: data.stops?.map((stop) => stop.trim()).filter(Boolean),
            status: data.status,
          },
        });
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
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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

      routeWhere.driverId = driver.id;
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
  ) {
    return this.updateAssignments(cooperativeUserId, routeId, data);
  }
}
