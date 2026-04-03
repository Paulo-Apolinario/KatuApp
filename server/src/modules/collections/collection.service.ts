import {
  CollectionStatus,
  CollectorStatus,
  DriverStatus,
  Prisma,
  RouteStatus,
  ScheduleStatus,
  UserRole,
  VehicleStatus,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";
import {
  CreateCollectionInput,
  UpdateCollectionStatusInput,
} from "./collection.schemas";

function isGeneratorRole(role: string) {
  return (
    role === UserRole.GENERATOR_SMALL || role === UserRole.GENERATOR_LARGE
  );
}

type MaterialItem = {
  type: string;
  quantityKg: number;
};

function normalizeMaterials(materials?: unknown): MaterialItem[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item: any) => ({
      type: String(item?.type || "").trim(),
      quantityKg: Number(item?.quantityKg || 0),
    }))
    .filter((item) => item.type.length > 0);
}

function calculateTotalWeight(materials: MaterialItem[]) {
  return materials.reduce((sum, item) => sum + Number(item.quantityKg || 0), 0);
}

function toPrismaJson(materials: MaterialItem[]): Prisma.InputJsonValue {
  return materials as unknown as Prisma.InputJsonValue;
}

const userSelect = {
  id: true,
  displayName: true,
  email: true,
  role: true,
  phone: true,
  isActive: true,
  accountStatus: true,
} as const;

const cooperativeSelect = {
  id: true,
  name: true,
  registrationNumber: true,
  email: true,
  phone: true,
  address: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
} as const;

const generatorInclude = {
  user: {
    select: userSelect,
  },
  cooperative: {
    select: cooperativeSelect,
  },
} as const;

const cooperativeInclude = {
  user: {
    select: userSelect,
  },
} as const;

const collectorInclude = {
  user: {
    select: userSelect,
  },
  cooperative: {
    select: cooperativeSelect,
  },
} as const;

const driverInclude = {
  cooperative: {
    select: cooperativeSelect,
  },
} as const;

const vehicleInclude = {
  cooperative: {
    select: cooperativeSelect,
  },
  driver: {
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
    },
  },
} as const;

const routeInclude = {
  driver: {
    select: {
      id: true,
      name: true,
      phone: true,
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
  cooperative: {
    select: cooperativeSelect,
  },
} as const;

const collectionInclude = {
  generator: {
    include: generatorInclude,
  },
  collector: {
    include: collectorInclude,
  },
  driver: {
    include: driverInclude,
  },
  vehicle: {
    include: vehicleInclude,
  },
  route: {
    include: routeInclude,
  },
  schedule: {
    include: {
      requestedBy: {
        select: userSelect,
      },
      generator: {
        include: generatorInclude,
      },
      cooperative: {
        include: cooperativeInclude,
      },
      collections: {
        include: {
          collector: {
            select: {
              id: true,
              name: true,
              phone: true,
              status: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
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
          route: {
            select: {
              id: true,
              name: true,
              status: true,
              scheduledDate: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc" as const,
        },
      },
    },
  },
} as const;

export class CollectionService {
  async create(
    authUserId: string,
    authUserRole: string,
    data: CreateCollectionInput
  ) {
    if (authUserRole !== UserRole.COOPERATIVE) {
      throw new Error("Apenas cooperativas podem delegar coletas.");
    }

    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: authUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const schedule = await prisma.schedule.findFirst({
      where: {
        id: data.scheduleId,
        cooperativeId: cooperative.id,
      },
      include: {
        generator: true,
        requestedBy: {
          select: userSelect,
        },
        collections: {
          where: {
            status: {
              in: [
                CollectionStatus.PENDING,
                CollectionStatus.IN_PROGRESS,
                CollectionStatus.COMPLETED,
              ],
            },
          },
          select: {
            id: true,
            status: true,
            routeId: true,
            collectorId: true,
            driverId: true,
            vehicleId: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new Error("Agendamento não encontrado para esta cooperativa.");
    }

    if (
      schedule.status === ScheduleStatus.CANCELLED ||
      schedule.status === ScheduleStatus.COMPLETED
    ) {
      throw new Error("Não é possível delegar um agendamento encerrado.");
    }

    if (schedule.collections.length > 0) {
      throw new Error("Este agendamento já possui uma coleta vinculada.");
    }

    const collector = await prisma.collector.findFirst({
      where: {
        id: data.collectorId,
        cooperativeId: cooperative.id,
        status: CollectorStatus.AVAILABLE,
      },
    });

    if (!collector) {
      throw new Error(
        "Catador não encontrado ou indisponível para esta cooperativa."
      );
    }

    let driver = null;
    if (data.driverId) {
      driver = await prisma.driver.findFirst({
        where: {
          id: data.driverId,
          cooperativeId: cooperative.id,
          status: {
            not: DriverStatus.INACTIVE,
          },
        },
      });

      if (!driver) {
        throw new Error(
          "Motorista não encontrado ou indisponível para esta cooperativa."
        );
      }
    }

    let vehicle = null;
    if (data.vehicleId) {
      vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          cooperativeId: cooperative.id,
          status: {
            not: VehicleStatus.INACTIVE,
          },
        },
      });

      if (!vehicle) {
        throw new Error(
          "Veículo não encontrado ou indisponível para esta cooperativa."
        );
      }
    }

    let route = null;
    if (data.routeId) {
      route = await prisma.route.findFirst({
        where: {
          id: data.routeId,
          cooperativeId: cooperative.id,
          status: {
            in: [RouteStatus.SCHEDULED, RouteStatus.IN_PROGRESS],
          },
        },
      });

      if (!route) {
        throw new Error(
          "Rota não encontrada ou indisponível para esta cooperativa."
        );
      }
    }

    if (vehicle && driver && vehicle.driverId && vehicle.driverId !== driver.id) {
      throw new Error("O veículo informado está vinculado a outro motorista.");
    }

    if (route) {
      if (route.driverId && !driver) {
        throw new Error(
          "A rota informada já possui motorista vinculado. Informe o motorista correspondente."
        );
      }

      if (route.vehicleId && !vehicle) {
        throw new Error(
          "A rota informada já possui veículo vinculado. Informe o veículo correspondente."
        );
      }

      if (driver && route.driverId && route.driverId !== driver.id) {
        throw new Error("A rota informada pertence a outro motorista.");
      }

      if (vehicle && route.vehicleId && route.vehicleId !== vehicle.id) {
        throw new Error("A rota informada pertence a outro veículo.");
      }
    }

    const normalizedMaterials = normalizeMaterials(data.materials);
    const safeTotal =
      typeof data.totalWeightKg === "number"
        ? data.totalWeightKg
        : calculateTotalWeight(normalizedMaterials);

    const [collection] = await prisma.$transaction([
      prisma.collection.create({
        data: {
          cooperativeId: cooperative.id,
          generatorId: schedule.generatorId ?? null,
          collectorId: collector.id,
          scheduleId: schedule.id,
          driverId: data.driverId || route?.driverId || null,
          vehicleId: data.vehicleId || route?.vehicleId || null,
          routeId: data.routeId || null,
          collectedAt: data.collectedAt ? new Date(data.collectedAt) : null,
          totalWeightKg: safeTotal,
          materials:
            normalizedMaterials.length > 0
              ? toPrismaJson(normalizedMaterials)
              : Prisma.JsonNull,
          notes: data.notes?.trim() || null,
          status: CollectionStatus.PENDING,
        },
        include: collectionInclude,
      }),
      prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          status: ScheduleStatus.SCHEDULED,
          scheduledDate: schedule.scheduledDate ?? new Date(),
        },
      }),
    ]);

    return collection;
  }

  async listMine(authUserId: string, authUserRole: string) {
    if (authUserRole === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
      });

      if (!cooperative) {
        throw new Error("Cooperativa do usuário autenticado não encontrada.");
      }

      return prisma.collection.findMany({
        where: {
          cooperativeId: cooperative.id,
        },
        include: collectionInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
    }

    if (authUserRole === UserRole.COLLECTOR) {
      const collector = await prisma.collector.findUnique({
        where: { userId: authUserId },
      });

      if (!collector) {
        throw new Error("Catador do usuário autenticado não encontrado.");
      }

      return prisma.collection.findMany({
        where: {
          collectorId: collector.id,
        },
        include: collectionInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
    }

    if (authUserRole === UserRole.DRIVER) {
      const driver = await prisma.driver.findUnique({
        where: { userId: authUserId },
      });

      if (!driver) {
        throw new Error("Motorista do usuário autenticado não encontrado.");
      }

      return prisma.collection.findMany({
        where: {
          driverId: driver.id,
        },
        include: collectionInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
    }

    if (isGeneratorRole(authUserRole)) {
      const generator = await prisma.generator.findUnique({
        where: { userId: authUserId },
      });

      if (!generator) {
        throw new Error("Gerador do usuário autenticado não encontrado.");
      }

      return prisma.collection.findMany({
        where: {
          generatorId: generator.id,
        },
        include: collectionInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
    }

    if (authUserRole === UserRole.PF) {
      return prisma.collection.findMany({
        where: {
          schedule: {
            requestedByUserId: authUserId,
          },
        },
        include: collectionInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      });
    }

    throw new Error("Usuário sem permissão para listar coletas.");
  }

  async findById(
    authUserId: string,
    authUserRole: string,
    collectionId: string
  ) {
    if (authUserRole === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
      });

      if (!cooperative) {
        throw new Error("Cooperativa do usuário autenticado não encontrada.");
      }

      const collection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          cooperativeId: cooperative.id,
        },
        include: collectionInclude,
      });

      if (!collection) {
        throw new Error("Coleta não encontrada.");
      }

      return collection;
    }

    if (authUserRole === UserRole.COLLECTOR) {
      const collector = await prisma.collector.findUnique({
        where: { userId: authUserId },
      });

      if (!collector) {
        throw new Error("Catador do usuário autenticado não encontrado.");
      }

      const collection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          collectorId: collector.id,
        },
        include: collectionInclude,
      });

      if (!collection) {
        throw new Error("Coleta não encontrada.");
      }

      return collection;
    }

    if (authUserRole === UserRole.DRIVER) {
      const driver = await prisma.driver.findUnique({
        where: { userId: authUserId },
      });

      if (!driver) {
        throw new Error("Motorista do usuário autenticado não encontrado.");
      }

      const collection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          driverId: driver.id,
        },
        include: collectionInclude,
      });

      if (!collection) {
        throw new Error("Coleta não encontrada.");
      }

      return collection;
    }

    if (isGeneratorRole(authUserRole)) {
      const generator = await prisma.generator.findUnique({
        where: { userId: authUserId },
      });

      if (!generator) {
        throw new Error("Gerador do usuário autenticado não encontrado.");
      }

      const collection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          generatorId: generator.id,
        },
        include: collectionInclude,
      });

      if (!collection) {
        throw new Error("Coleta não encontrada.");
      }

      return collection;
    }

    if (authUserRole === UserRole.PF) {
      const collection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          schedule: {
            requestedByUserId: authUserId,
          },
        },
        include: collectionInclude,
      });

      if (!collection) {
        throw new Error("Coleta não encontrada.");
      }

      return collection;
    }

    throw new Error("Usuário sem permissão para consultar coleta.");
  }

  async updateStatus(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: UpdateCollectionStatusInput
  ) {
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        schedule: true,
      },
    });

    if (!collection) {
      throw new Error("Coleta não encontrada.");
    }

    if (authUserRole === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
      });

      if (!cooperative || collection.cooperativeId !== cooperative.id) {
        throw new Error("Coleta não encontrada para esta cooperativa.");
      }
    } else if (authUserRole === UserRole.COLLECTOR) {
      const collector = await prisma.collector.findUnique({
        where: { userId: authUserId },
      });

      if (!collector || collection.collectorId !== collector.id) {
        throw new Error("Coleta não encontrada para este catador.");
      }
    } else if (authUserRole === UserRole.DRIVER) {
      const driver = await prisma.driver.findUnique({
        where: { userId: authUserId },
      });

      if (!driver || collection.driverId !== driver.id) {
        throw new Error("Coleta não encontrada para este motorista.");
      }
    } else {
      throw new Error("Usuário sem permissão para atualizar coleta.");
    }

    const incomingMaterials =
      typeof data.materials !== "undefined"
        ? normalizeMaterials(data.materials)
        : normalizeMaterials(collection.materials as unknown);

    const calculatedTotal = calculateTotalWeight(incomingMaterials);

    if (
      data.status === CollectionStatus.COMPLETED &&
      incomingMaterials.length === 0
    ) {
      throw new Error(
        "Informe ao menos um material com quantidade para concluir a coleta."
      );
    }

    if (
      data.status === CollectionStatus.COMPLETED &&
      incomingMaterials.some((item) => Number(item.quantityKg) <= 0)
    ) {
      throw new Error(
        "Todas as quantidades dos materiais devem ser maiores que zero."
      );
    }

    const materialsToSave: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull =
      typeof data.materials !== "undefined"
        ? incomingMaterials.length > 0
          ? toPrismaJson(incomingMaterials)
          : Prisma.JsonNull
        : collection.materials === null
        ? Prisma.JsonNull
        : (collection.materials as Prisma.InputJsonValue);

    const totalWeightToSave =
      data.status === CollectionStatus.COMPLETED
        ? calculatedTotal
        : typeof data.totalWeightKg === "number"
        ? data.totalWeightKg
        : collection.totalWeightKg;

    const nextScheduleStatus =
      data.status === CollectionStatus.IN_PROGRESS
        ? ScheduleStatus.IN_PROGRESS
        : data.status === CollectionStatus.COMPLETED
        ? ScheduleStatus.COMPLETED
        : data.status === CollectionStatus.CANCELLED
        ? ScheduleStatus.CANCELLED
        : ScheduleStatus.SCHEDULED;

    const [updatedCollection] = await prisma.$transaction([
      prisma.collection.update({
        where: { id: collection.id },
        data: {
          status: data.status,
          collectedAt:
            data.status === CollectionStatus.COMPLETED
              ? data.collectedAt
                ? new Date(data.collectedAt)
                : new Date()
              : data.collectedAt
              ? new Date(data.collectedAt)
              : collection.collectedAt,
          totalWeightKg: totalWeightToSave,
          materials: materialsToSave,
          notes:
            typeof data.notes === "string"
              ? data.notes.trim() || null
              : collection.notes,
        },
        include: collectionInclude,
      }),
      prisma.schedule.update({
        where: { id: collection.scheduleId! },
        data: {
          status: nextScheduleStatus,
        },
      }),
    ]);

    return updatedCollection;
  }
}