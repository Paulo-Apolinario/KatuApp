import { CollectionStatus, RouteStatus, UserRole } from "@prisma/client";
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
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const collectionInclude = {
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
    0
  );

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Data inválida.");
  }

  return parsedDate;
}

function buildRouteStats(
  collections: Array<{ status: CollectionStatus }>
) {
  return {
    totalCollections: collections.length,
    pendingCollections: collections.filter(
      (item) => item.status === CollectionStatus.PENDING
    ).length,
    inProgressCollections: collections.filter(
      (item) => item.status === CollectionStatus.IN_PROGRESS
    ).length,
    completedCollections: collections.filter(
      (item) => item.status === CollectionStatus.COMPLETED
    ).length,
    cancelledCollections: collections.filter(
      (item) => item.status === CollectionStatus.CANCELLED
    ).length,
  };
}

export class RouteService {
  async create(cooperativeUserId: string, data: CreateRouteInput) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    if (data.driverId) {
      const driver = await prisma.driver.findFirst({
        where: {
          id: data.driverId,
          cooperativeId: cooperative.id,
        },
      });

      if (!driver) {
        throw new Error("Motorista não encontrado para esta cooperativa.");
      }
    }

    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          cooperativeId: cooperative.id,
        },
      });

      if (!vehicle) {
        throw new Error("Veículo não encontrado para esta cooperativa.");
      }
    }

    if (data.driverId && data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          cooperativeId: cooperative.id,
        },
      });

      if (vehicle?.driverId && vehicle.driverId !== data.driverId) {
        throw new Error("Este veículo já está vinculado a outro motorista.");
      }
    }

    const normalizedStops = data.stops
      .map((stop) => stop.trim())
      .filter(Boolean);

    const route = await prisma.route.create({
      data: {
        cooperativeId: cooperative.id,
        driverId: data.driverId || null,
        vehicleId: data.vehicleId || null,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        scheduledDate: normalizeDate(data.scheduledDate),
        stops: normalizedStops,
        status: data.status ?? RouteStatus.SCHEDULED,
      },
      include: routeInclude,
    });

    const collections = await prisma.collection.findMany({
      where: {
        routeId: route.id,
      },
      include: collectionInclude,
      orderBy: [{ collectedAt: "asc" }, { createdAt: "desc" }],
    });

    return {
      ...route,
      collections,
      activeCollections: collections.filter(
        (item) =>
          item.status !== CollectionStatus.COMPLETED &&
          item.status !== CollectionStatus.CANCELLED
      ),
      stats: buildRouteStats(collections),
    };
  }

  async addCollectionToRoute(
    cooperativeUserId: string,
    routeId: string,
    collectionId: string
  ) {
    const route = await this.findById(cooperativeUserId, UserRole.COOPERATIVE, routeId);

    const collection = await prisma.collection.findFirst({
      where: {
        id: collectionId,
        cooperativeId: route.cooperativeId,
      },
      include: {
        route: true,
        schedule: true,
        generator: true,
        collector: true,
      },
    });

    if (!collection) {
      throw new Error("Coleta não encontrada para esta cooperativa.");
    }

    if (
      collection.status === CollectionStatus.COMPLETED ||
      collection.status === CollectionStatus.CANCELLED
    ) {
      throw new Error(
        "Não é possível adicionar à rota uma coleta concluída ou cancelada."
      );
    }

    if (collection.routeId && collection.routeId !== route.id) {
      throw new Error("Esta coleta já está vinculada a outra rota.");
    }

    return prisma.collection.update({
      where: { id: collection.id },
      data: {
        routeId: route.id,
        driverId: route.driverId ?? null,
        vehicleId: route.vehicleId ?? null,
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
  }

  async removeCollectionFromRoute(
    cooperativeUserId: string,
    routeId: string,
    collectionId: string
  ) {
    const route = await this.findById(cooperativeUserId, UserRole.COOPERATIVE, routeId);

    const collection = await prisma.collection.findFirst({
      where: {
        id: collectionId,
        cooperativeId: route.cooperativeId,
        routeId: route.id,
      },
    });

    if (!collection) {
      throw new Error("Coleta não encontrada nesta rota.");
    }

    if (
      collection.status === CollectionStatus.COMPLETED ||
      collection.status === CollectionStatus.CANCELLED
    ) {
      throw new Error(
        "Não é possível remover da rota uma coleta concluída ou cancelada."
      );
    }

    return prisma.collection.update({
      where: { id: collection.id },
      data: {
        routeId: null,
        driverId: null,
        vehicleId: null,
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
    data: UpdateRouteAssignmentsInput
  ) {
    const route = await this.findById(
      cooperativeUserId,
      UserRole.COOPERATIVE,
      routeId
    );

    if (data.driverId) {
      const driver = await prisma.driver.findFirst({
        where: {
          id: data.driverId,
          cooperativeId: route.cooperativeId,
        },
      });

      if (!driver) {
        throw new Error("Motorista não encontrado para esta cooperativa.");
      }
    }

    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          cooperativeId: route.cooperativeId,
        },
      });

      if (!vehicle) {
        throw new Error("Veículo não encontrado para esta cooperativa.");
      }
    }

    if (data.driverId && data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          cooperativeId: route.cooperativeId,
        },
      });

      if (vehicle?.driverId && vehicle.driverId !== data.driverId) {
        throw new Error("Este veículo já está vinculado a outro motorista.");
      }
    }

    const normalizedStops =
      data.stops === undefined
        ? route.stops
        : data.stops.map((stop) => stop.trim()).filter(Boolean);

    const updatedRoute = await prisma.route.update({
      where: { id: route.id },
      data: {
        driverId:
          data.driverId === undefined ? route.driverId : data.driverId,
        vehicleId:
          data.vehicleId === undefined ? route.vehicleId : data.vehicleId,
        name: data.name?.trim() ?? route.name,
        description:
          data.description === undefined
            ? route.description
            : data.description?.trim() || null,
        scheduledDate:
          data.scheduledDate === undefined
            ? route.scheduledDate
            : normalizeDate(data.scheduledDate),
        stops: normalizedStops,
      },
      include: routeInclude,
    });

    await prisma.collection.updateMany({
      where: {
        routeId: updatedRoute.id,
        status: {
          in: [CollectionStatus.PENDING, CollectionStatus.IN_PROGRESS],
        },
      },
      data: {
        driverId: updatedRoute.driverId,
        vehicleId: updatedRoute.vehicleId,
      },
    });

    return this.findById(
      cooperativeUserId,
      UserRole.COOPERATIVE,
      updatedRoute.id
    );
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
        (collection) => collection.routeId === route.id
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
        (collection) => collection.routeId === route.id
      );

      return {
        ...route,
        stats: buildRouteStats(routeCollections),
      };
    });
  }

  async findById(authUserId: string, authUserRole: string, routeId: string) {
    let routeWhere: { id: string; cooperativeId?: string; driverId?: string } = {
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

    const collections = await prisma.collection.findMany({
      where: {
        routeId: route.id,
      },
      include: collectionInclude,
      orderBy: [{ collectedAt: "asc" }, { createdAt: "desc" }],
    });

    const activeCollections = collections.filter(
      (item) =>
        item.status !== CollectionStatus.COMPLETED &&
        item.status !== CollectionStatus.CANCELLED
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
    data: UpdateRouteStatusInput
  ) {
    const route = await this.findById(
      cooperativeUserId,
      UserRole.COOPERATIVE,
      routeId
    );

    if (
      data.status === RouteStatus.CANCELLED &&
      route.activeCollections.length > 0
    ) {
      throw new Error(
        "Não é possível cancelar uma rota com coletas operacionais ativas."
      );
    }

    const updatedRoute = await prisma.route.update({
      where: { id: route.id },
      data: {
        status: data.status,
      },
      include: routeInclude,
    });

    const collections = await prisma.collection.findMany({
      where: {
        routeId: updatedRoute.id,
      },
      include: collectionInclude,
      orderBy: [{ collectedAt: "asc" }, { createdAt: "desc" }],
    });

    return {
      ...updatedRoute,
      collections,
      activeCollections: collections.filter(
        (item) =>
          item.status !== CollectionStatus.COMPLETED &&
          item.status !== CollectionStatus.CANCELLED
      ),
      stats: buildRouteStats(collections),
    };
  }
}