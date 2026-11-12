import { withRegistration } from "../registrations/registration-summary";
import { documentType, withGeneratorDocument } from "./generator-document";
import {
  Prisma,
  GeneratorAccessStatus,
  GeneratorType,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { CreateGeneratorInput, UpdateGeneratorInput } from "./generator.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeCoordinate(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function buildStreetLine(data: CreateGeneratorInput) {
  const street = data.street?.trim();
  const number = data.number?.trim();

  if (street && number) return `${number} ${street}`;
  if (street) return street;
  return undefined;
}

async function geocodeAddress(data: CreateGeneratorInput) {
  const street = buildStreetLine(data);
  const city = data.city?.trim();
  const state = data.state?.trim();
  const postalcode = data.zipCode?.trim();

  const hasEnoughAddress =
    !!street || !!city || !!state || !!postalcode || !!data.address?.trim();

  if (!hasEnoughAddress) {
    return {
      latitude: null,
      longitude: null,
    };
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "br",
  });

  if (street) params.set("street", street);
  if (city) params.set("city", city);
  if (state) params.set("state", state);
  if (postalcode) params.set("postalcode", postalcode);

  if (!street && data.address?.trim()) {
    params.set("q", data.address.trim());
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "User-Agent": "KATU/1.0 (geocoding generators)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    throw new Error("Não foi possível geocodificar o endereço do gerador.");
  }

  const results = (await response.json()) as Array<{
    lat?: string;
    lon?: string;
  }>;

  const first = results?.[0];

  if (!first?.lat || !first?.lon) {
    return {
      latitude: null,
      longitude: null,
    };
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);

  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

export class GeneratorService {
  async create(cooperativeUserId: string, data: CreateGeneratorInput, database: Prisma.TransactionClient = prisma) {
    const cooperative = await database.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    if (data.type === "LARGE" && documentType(data.documentNumber) === "CPF") {
      throw Object.assign(new Error("Para grande gerador, informe um CNPJ."), { statusCode: 400 });
    }
    const email = data.email ? normalizeEmail(data.email) : null;

    if (email) {
      const [existingUser, existingGenerator, existingCollector] = await Promise.all([
        database.user.findUnique({ where: { email } }),
        database.generator.findUnique({ where: { email } }),
        database.collector.findUnique({ where: { email } }),
      ]);
      if (existingUser || existingGenerator || existingCollector)
        throw new Error("Já existe um cadastro com este e-mail.");
    }

    const fullAddress = buildFullAddress(data);

    let latitude = normalizeCoordinate(data.latitude);
    let longitude = normalizeCoordinate(data.longitude);

    if (latitude === null || longitude === null) {
      const geocoded = await geocodeAddress({
        ...data,
        address: fullAddress ?? data.address,
      }).catch(() => ({ latitude: null, longitude: null }));

      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

    const generator = await database.generator.create({
      data: {
        cooperativeId: cooperative.id,
        type: data.type === "LARGE" ? GeneratorType.LARGE : GeneratorType.SMALL,
        name: data.name.trim(),
        companyName: normalizeText(data.companyName),
        email,
        phone: normalizeText(data.phone),
        documentNumber: data.documentNumber || null,

        zipCode: normalizeText(data.zipCode),
        street: normalizeText(data.street),
        number: normalizeText(data.number),
        neighborhood: normalizeText(data.neighborhood),
        city: normalizeText(data.city),
        state: normalizeText(data.state),
        address: fullAddress,

        latitude,
        longitude,

        status: normalizeText(data.status) || "ativo",
        accessReleased: false,
        accessStatus: GeneratorAccessStatus.PENDING_ACTIVATION,
        totalKg: 0,
      },
    });

    return withRegistration("GENERATOR", withGeneratorDocument(generator));
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

    return generators.map(value => withRegistration("GENERATOR", withGeneratorDocument(value)));
  }

  async update(cooperativeUserId: string, generatorId: string, data: UpdateGeneratorInput) {
    const cooperative = await prisma.cooperative.findUnique({ where: { userId: cooperativeUserId }, select: { id: true } });
    if (!cooperative) return null;
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Generator" WHERE id=${generatorId} AND "cooperativeId"=${cooperative.id} FOR UPDATE`;
      const current = await tx.generator.findFirst({ where: { id: generatorId, cooperativeId: cooperative.id } });
      if (!current) return null;
      if ((data.type || current.type) === "LARGE" && documentType(data.documentNumber ?? current.documentNumber) === "CPF") {
        throw Object.assign(new Error("Para grande gerador, informe um CNPJ."), { statusCode: 400 });
      }
      if (data.email && data.email !== current.email) {
        if (current.userId) throw Object.assign(new Error("Este gerador já tem acesso ativo. O e-mail de login não pode ser alterado nesta tela."), { statusCode: 400 });
        const [generator, collector, user] = await Promise.all([
          tx.generator.findFirst({ where: { email: data.email, id: { not: current.id } } }),
          tx.collector.findUnique({ where: { email: data.email } }),
          tx.user.findUnique({ where: { email: data.email } }),
        ]);
        if (generator || collector || user) throw Object.assign(new Error("Já existe um cadastro com este e-mail."), { statusCode: 409 });
      }
      const result = await tx.generator.update({ where: { id: current.id }, data });
      return withRegistration("GENERATOR", withGeneratorDocument(result));
    });
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

    return withRegistration("GENERATOR", withGeneratorDocument(generator));
  }
}