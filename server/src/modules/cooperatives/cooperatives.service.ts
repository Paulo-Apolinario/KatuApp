import { prisma } from "../../lib/prisma";

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
        address: true,
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
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!cooperative) {
      throw new Error("Cooperativa não encontrada.");
    }

    return cooperative;
  }
}