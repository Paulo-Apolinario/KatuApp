import {
  CollectionStatus,
  CollectorStatus,
  DriverStatus,
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
          select: {
            id: true,
            displayName: true,
            email: true,
            role: true,
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
      if (driver && route.driverId && route.driverId !== driver.id) {
        throw new Error("A rota informada pertence a outro motorista.");
      }

      if (vehicle && route.vehicleId && route.vehicleId !== vehicle.id) {
        throw new Error("A rota informada pertence a outro veículo.");
      }
    }

    const existingCollection = await prisma.collection.findFirst({
      where: {
        scheduleId: schedule.id,
        status: {
          in: [
            CollectionStatus.PENDING,
            CollectionStatus.IN_PROGRESS,
            CollectionStatus.COMPLETED,
          ],
        },
      },
    });

    if (existingCollection) {
      throw new Error("Este agendamento já possui uma coleta vinculada.");
    }

    const [collection] = await prisma.$transaction([
      prisma.collection.create({
        data: {
          cooperativeId: cooperative.id,
          generatorId: schedule.generatorId ?? null,
          collectorId: collector.id,
          scheduleId: schedule.id,
          driverId: data.driverId || null,
          vehicleId: data.vehicleId || null,
          routeId: data.routeId || null,
          collectedAt: data.collectedAt ? new Date(data.collectedAt) : null,
          totalWeightKg: data.totalWeightKg ?? 0,
          materials: data.materials ?? [],
          notes: data.notes?.trim() || null,
          status: CollectionStatus.PENDING,
        },
        include: {
          generator: true,
          collector: true,
          driver: true,
          vehicle: true,
          route: true,
          schedule: {
            include: {
              requestedBy: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
      prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          status: ScheduleStatus.SCHEDULED,
        },
      }),
    ]);

    return collection;
  }

  async listMine(authUserId: string, authUserRole: string) {
    const includeRelations = {
      generator: true,
      collector: true,
      driver: true,
      vehicle: true,
      route: true,
      schedule: {
        include: {
          requestedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true,
            },
          },
        },
      },
    };

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
        include: includeRelations,
        orderBy: {
          createdAt: "desc",
        },
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
        include: includeRelations,
        orderBy: {
          createdAt: "desc",
        },
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
        include: includeRelations,
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    if (authUserRole === UserRole.PF) {
      return prisma.collection.findMany({
        where: {
          schedule: {
            requestedByUserId: authUserId,
          },
        },
        include: includeRelations,
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    throw new Error("Usuário sem permissão para listar coletas.");
  }

  async findById(
    authUserId: string,
    authUserRole: string,
    collectionId: string
  ) {
    const includeRelations = {
      generator: true,
      collector: true,
      driver: true,
      vehicle: true,
      route: true,
      schedule: {
        include: {
          requestedBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
              role: true,
            },
          },
        },
      },
    };

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
        include: includeRelations,
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
        include: includeRelations,
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
        include: includeRelations,
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
        include: includeRelations,
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
    } else {
      throw new Error("Usuário sem permissão para atualizar coleta.");
    }

    const nextScheduleStatus =
      data.status === "IN_PROGRESS"
        ? ScheduleStatus.IN_PROGRESS
        : data.status === "COMPLETED"
        ? ScheduleStatus.COMPLETED
        : data.status === "CANCELLED"
        ? ScheduleStatus.CANCELLED
        : ScheduleStatus.SCHEDULED;

    const [updatedCollection] = await prisma.$transaction([
      prisma.collection.update({
        where: { id: collection.id },
        data: {
          status: data.status,
          collectedAt: data.collectedAt
            ? new Date(data.collectedAt)
            : collection.collectedAt,
          totalWeightKg:
            typeof data.totalWeightKg === "number"
              ? data.totalWeightKg
              : collection.totalWeightKg,
          materials: data.materials ?? [],
          notes:
            typeof data.notes === "string"
              ? data.notes.trim() || null
              : collection.notes,
        },
        include: {
          generator: true,
          collector: true,
          driver: true,
          vehicle: true,
          route: true,
          schedule: {
            include: {
              requestedBy: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
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