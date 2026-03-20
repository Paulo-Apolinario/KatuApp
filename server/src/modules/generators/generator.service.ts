import {
  GeneratorAccessStatus,
  GeneratorType,
  UserRole,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";
import {
  CreateGeneratorInput,
} from "./generator.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class GeneratorService {
  async create(cooperativeUserId: string, data: CreateGeneratorInput) {
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

    const existingGenerator = await prisma.generator.findUnique({
      where: { email },
    });

    if (existingGenerator) {
      throw new Error("Já existe um gerador com este e-mail.");
    }

    const generator = await prisma.generator.create({
      data: {
        cooperativeId: cooperative.id,
        type: data.type === "LARGE" ? GeneratorType.LARGE : GeneratorType.SMALL,
        name: data.name.trim(),
        companyName: data.companyName?.trim() || null,
        email,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        status: data.status?.trim() || "ativo",
        accessReleased: false,
        accessStatus: GeneratorAccessStatus.PENDING_ACTIVATION,
        totalKg: 0,
      },
    });

    return generator;
  }

  async listByAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const generators = await prisma.generator.findMany({
      where: {
        cooperativeId: cooperative.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return generators;
  }

  async findById(cooperativeUserId: string, generatorId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const generator = await prisma.generator.findFirst({
      where: {
        id: generatorId,
        cooperativeId: cooperative.id,
      },
    });

    if (!generator) {
      throw new Error("Gerador não encontrado.");
    }

    return generator;
  }
}
