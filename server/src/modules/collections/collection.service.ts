import {
  CollectionStatus,
  CollectorStatus,
  ScheduleStatus,
  UserRole,
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
    if (authUserRole === UserRole.COOPERATIVE) {
      return this.createByCooperative(authUserId, data);
    }

    if (authUserRole === UserRole.COLLECTOR) {
      return this.createByCollector(authUserId, data);
    }

    throw new Error("Usuário sem permissão para registrar coleta.");
  }

  private async createByCooperative(
    cooperativeUserId: string,
    data: CreateCollectionInput
  ) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
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
      },
    });

    if (!schedule) {
      throw new Error("Agendamento não encontrado para esta cooperativa.");
    }

    const existingCollection = await prisma.collection.findFirst({
      where: {
        scheduleId: schedule.id,
      },
    });

    if (existingCollection) {
      throw new Error("Já existe coleta registrada para este agendamento.");
    }

    const collection = await prisma.$transaction(async (tx) => {
      const createdCollection = await tx.collection.create({
        data: {
          cooperativeId: cooperative.id,
          generatorId: schedule.generatorId,
          collectorId: null,
          scheduleId: schedule.id,
          collectedAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
          totalWeightKg: data.totalWeightKg,
          materials: data.materials,
          notes: data.notes?.trim() || null,
          status: CollectionStatus.COMPLETED,
        },
        include: {
          generator: true,
          collector: true,
          schedule: true,
        },
      });

      await tx.generator.update({
        where: { id: schedule.generatorId },
        data: {
          totalKg: {
            increment: data.totalWeightKg,
          },
        },
      });

      await tx.schedule.update({
        where: { id: schedule.id },
        data: {
          status: ScheduleStatus.COMPLETED,
        },
      });

      return createdCollection;
    });

    return collection;
  }

  private async createByCollector(
  collectorUserId: string,
  data: CreateCollectionInput
) {
  const collector = await prisma.collector.findUnique({
    where: { userId: collectorUserId },
  });

  if (!collector) {
    throw new Error("Catador do usuário autenticado não encontrado.");
  }

  if (!collector.cooperativeId) {
    throw new Error("Catador não está vinculado a uma cooperativa.");
  }

  const cooperativeId = collector.cooperativeId;

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: data.scheduleId,
      cooperativeId,
    },
    include: {
      generator: true,
    },
  });

  if (!schedule) {
    throw new Error("Agendamento não encontrado para a cooperativa do catador.");
  }

  const existingCollection = await prisma.collection.findFirst({
    where: {
      scheduleId: schedule.id,
    },
  });

  if (existingCollection) {
    throw new Error("Já existe coleta registrada para este agendamento.");
  }

  const collection = await prisma.$transaction(async (tx) => {
    const createdCollection = await tx.collection.create({
      data: {
        cooperativeId,
        generatorId: schedule.generatorId,
        collectorId: collector.id,
        scheduleId: schedule.id,
        collectedAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
        totalWeightKg: data.totalWeightKg,
        materials: data.materials,
        notes: data.notes?.trim() || null,
        status: CollectionStatus.COMPLETED,
      },
      include: {
        generator: true,
        collector: true,
        schedule: true,
      },
    });

    await tx.generator.update({
      where: { id: schedule.generatorId },
      data: {
        totalKg: {
          increment: data.totalWeightKg,
        },
      },
    });

    await tx.collector.update({
      where: { id: collector.id },
      data: {
        collectionsToday: {
          increment: 1,
        },
        totalKg: {
          increment: data.totalWeightKg,
        },
        kgMonth: {
          increment: data.totalWeightKg,
        },
        status: CollectorStatus.AVAILABLE,
      },
    });

    await tx.schedule.update({
      where: { id: schedule.id },
      data: {
        status: ScheduleStatus.COMPLETED,
      },
    });

    return createdCollection;
  });

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
        include: {
          generator: true,
          collector: true,
          schedule: true,
        },
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
        include: {
          generator: true,
          collector: true,
          schedule: true,
        },
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
        include: {
          generator: true,
          collector: true,
          schedule: true,
        },
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
        include: {
          generator: true,
          collector: true,
          schedule: true,
        },
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
        include: {
          generator: true,
          collector: true,
          schedule: true,
        },
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
        include: {
          generator: true,
          collector: true,
          schedule: true,
        },
      });

      if (!collection) {
        throw new Error("Coleta não encontrada.");
      }

      return collection;
    }

    throw new Error("Usuário sem permissão para consultar coletas.");
  }

  async updateStatus(
    cooperativeUserId: string,
    collectionId: string,
    data: UpdateCollectionStatusInput
  ) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const existingCollection = await prisma.collection.findFirst({
      where: {
        id: collectionId,
        cooperativeId: cooperative.id,
      },
    });

    if (!existingCollection) {
      throw new Error("Coleta não encontrada.");
    }

    const updatedCollection = await prisma.collection.update({
      where: { id: existingCollection.id },
      data: {
        status: CollectionStatus[data.status],
      },
      include: {
        generator: true,
        collector: true,
        schedule: true,
      },
    });

    return updatedCollection;
  }
}