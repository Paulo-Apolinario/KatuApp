import { prisma } from "../../lib/prisma";
import { UpdateCooperativeLocationInput } from "./cooperatives.schemas";

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function hasValidCoordinates(
  latitude?: number | null,
  longitude?: number | null
) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  );
}

export class CooperativesService {
  async listActive() {
    const cooperatives = await prisma.cooperative.findMany({
      where: {
        user: {
          role: "COOPERATIVE",
          isActive: true,
          accountStatus: "ACTIVE",
        },
      },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
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
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return cooperatives;
  }

  async getById(id: string) {
    const cooperative = await prisma.cooperative.findFirst({
      where: {
        id,
        user: {
          role: "COOPERATIVE",
          isActive: true,
          accountStatus: "ACTIVE",
        },
      },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!cooperative) {
      throw new Error("Cooperativa não encontrada.");
    }

    return cooperative;
  }

  async updateLocationByUserId(
    userId: string,
    data: UpdateCooperativeLocationInput
  ) {
    const cooperative = await prisma.cooperative.findFirst({
      where: {
        userId,
        user: {
          role: "COOPERATIVE",
          isActive: true,
          accountStatus: "ACTIVE",
        },
      },
    });

    if (!cooperative) {
      throw new Error("Cooperativa não encontrada para o usuário autenticado.");
    }

    if (
      (data.latitude !== undefined || data.longitude !== undefined) &&
      !hasValidCoordinates(data.latitude, data.longitude)
    ) {
      throw new Error(
        "Latitude e longitude devem ser informadas juntas e com valores válidos."
      );
    }

    const updated = await prisma.cooperative.update({
      where: { id: cooperative.id },
      data: {
        zipCode: normalizeOptionalText(data.zipCode),
        street: normalizeOptionalText(data.street),
        number: normalizeOptionalText(data.number),
        neighborhood: normalizeOptionalText(data.neighborhood),
        city: normalizeOptionalText(data.city),
        state: normalizeOptionalText(data.state),
        address: normalizeOptionalText(data.address),
        latitude:
          typeof data.latitude === "number" ? data.latitude : cooperative.latitude,
        longitude:
          typeof data.longitude === "number"
            ? data.longitude
            : cooperative.longitude,
      },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}