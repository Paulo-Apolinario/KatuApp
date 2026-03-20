import { CollectorStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  CreateCollectorInput,
  UpdateCollectorStatusInput,
} from "./collector.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class CollectorService {
  async create(cooperativeUserId: string, data: CreateCollectorInput) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const email = normalizeEmail(data.email);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Já existe um usuário com este e-mail.");
    }

    const existingCollector = await prisma.collector.findUnique({
      where: { email },
    });

    if (existingCollector) {
      throw new Error("Já existe um catador com este e-mail.");
    }

    const collector = await prisma.collector.create({
      data: {
        cooperativeId: cooperative.id,
        name: data.name.trim(),
        email,
        phone: data.phone?.trim() || null,
        rg: data.rg?.trim() || null,
        birthDate: data.birthDate?.trim() || null,
        status: data.status
          ? CollectorStatus[data.status]
          : CollectorStatus.AVAILABLE,
        kgMonth: 0,
        collectionsToday: 0,
        totalKg: 0,
      },
    });

    return collector;
  }

  async listByAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const collectors = await prisma.collector.findMany({
      where: {
        cooperativeId: cooperative.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return collectors;
  }

  async findById(cooperativeUserId: string, collectorId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const collector = await prisma.collector.findFirst({
      where: {
        id: collectorId,
        cooperativeId: cooperative.id,
      },
    });

    if (!collector) {
      throw new Error("Catador não encontrado.");
    }

    return collector;
  }

  async updateStatus(
    cooperativeUserId: string,
    collectorId: string,
    status: UpdateCollectorStatusInput["status"]
  ) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const collector = await prisma.collector.findFirst({
      where: {
        id: collectorId,
        cooperativeId: cooperative.id,
      },
    });

    if (!collector) {
      throw new Error("Catador não encontrado.");
    }

    const updatedCollector = await prisma.collector.update({
      where: { id: collector.id },
      data: {
        status: CollectorStatus[status],
      },
    });

    return updatedCollector;
  }
}