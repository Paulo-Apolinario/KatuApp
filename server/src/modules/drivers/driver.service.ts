import { DriverStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  CreateDriverInput,
  UpdateDriverStatusInput,
} from "./driver.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class DriverService {
  async create(cooperativeUserId: string, data: CreateDriverInput) {
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

    const existingDriver = await prisma.driver.findUnique({
      where: { email },
    });

    if (existingDriver) {
      throw new Error("Já existe um motorista com este e-mail.");
    }

    return prisma.driver.create({
      data: {
        cooperativeId: cooperative.id,
        name: data.name.trim(),
        email,
        phone: data.phone?.trim() || null,
        cpf: data.cpf?.trim() || null,
        cnh: data.cnh?.trim() || null,
        cnhCategory: data.cnhCategory?.trim() || null,
        status: data.status
          ? DriverStatus[data.status]
          : DriverStatus.AVAILABLE,
      },
    });
  }

  async listByAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    return prisma.driver.findMany({
      where: { cooperativeId: cooperative.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(cooperativeUserId: string, driverId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const driver = await prisma.driver.findFirst({
      where: {
        id: driverId,
        cooperativeId: cooperative.id,
      },
    });

    if (!driver) {
      throw new Error("Motorista não encontrado.");
    }

    return driver;
  }

  async updateStatus(
    cooperativeUserId: string,
    driverId: string,
    data: UpdateDriverStatusInput
  ) {
    const driver = await this.findById(cooperativeUserId, driverId);

    return prisma.driver.update({
      where: { id: driver.id },
      data: {
        status: DriverStatus[data.status],
      },
    });
  }
}
