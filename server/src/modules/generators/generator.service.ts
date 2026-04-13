import {
  GeneratorAccessStatus,
  GeneratorType,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { CreateGeneratorInput } from "./generator.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildFullAddress(data: CreateGeneratorInput) {
  if (data.address?.trim()) {
    return data.address.trim();
  }

  const parts = [
    data.street?.trim(),
    data.number?.trim(),
    data.neighborhood?.trim(),
    data.city?.trim(),
    data.state?.trim(),
    data.zipCode?.trim(),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
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

    const fullAddress = buildFullAddress(data);

    const generator = await prisma.generator.create({
      data: {
        cooperativeId: cooperative.id,
        type: data.type === "LARGE" ? GeneratorType.LARGE : GeneratorType.SMALL,
        name: data.name.trim(),
        companyName: normalizeText(data.companyName),
        email,
        phone: normalizeText(data.phone),

        zipCode: normalizeText(data.zipCode),
        street: normalizeText(data.street),
        number: normalizeText(data.number),
        neighborhood: normalizeText(data.neighborhood),
        city: normalizeText(data.city),
        state: normalizeText(data.state),
        address: fullAddress,

        latitude:
          typeof data.latitude === "number" ? data.latitude : null,
        longitude:
          typeof data.longitude === "number" ? data.longitude : null,

        status: normalizeText(data.status) || "ativo",
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