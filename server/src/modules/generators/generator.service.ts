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

    let latitude = normalizeCoordinate(data.latitude);
    let longitude = normalizeCoordinate(data.longitude);

    if (latitude === null || longitude === null) {
      const geocoded = await geocodeAddress({
        ...data,
        address: fullAddress ?? data.address,
      });

      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
    }

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

        latitude,
        longitude,

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