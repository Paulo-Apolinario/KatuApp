import { DriverReportType, DriverStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  CreateDriverInput,
  CreateDriverReportInput,
  UpdateDriverStatusInput,
  UpdateMyDriverProfileInput,
} from "./driver.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeDigits(value?: string) {
  return value ? value.replace(/\D/g, "") : undefined;
}

export class DriverService {
  private async getAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    return cooperative;
  }

  private async getAuthenticatedDriverByUserId(userId: string) {
    const driver = await prisma.driver.findFirst({
      where: { userId },
      include: {
        cooperative: true,
        user: true,
      },
    });

    if (!driver) {
      throw new Error("Motorista autenticado não encontrado.");
    }

    return driver;
  }

  async create(cooperativeUserId: string, data: CreateDriverInput) {
    const cooperative = await this.getAuthenticatedCooperative(cooperativeUserId);

    const email = normalizeEmail(data.email);
    const cpf = sanitizeDigits(data.cpf);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Já existe um usuário com este e-mail.");
    }

    const existingDriverByEmail = await prisma.driver.findUnique({
      where: { email },
    });

    if (existingDriverByEmail) {
      throw new Error("Já existe um motorista com este e-mail.");
    }

    if (cpf) {
      const existingDriverByCpf = await prisma.driver.findFirst({
        where: {
          cpf,
          cooperativeId: cooperative.id,
        },
      });

      if (existingDriverByCpf) {
        throw new Error("Já existe um motorista com este CPF nesta cooperativa.");
      }
    }

    return prisma.driver.create({
      data: {
        cooperativeId: cooperative.id,
        name: data.name.trim(),
        email,
        phone: data.phone?.trim() || null,
        cpf: cpf || null,
        cnh: data.cnh?.trim() || null,
        cnhCategory: data.cnhCategory?.trim().toUpperCase() || null,
        notes: data.notes?.trim() || null,
        status: data.status
          ? DriverStatus[data.status]
          : DriverStatus.AVAILABLE,
      },
    });
  }

  async listByAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative = await this.getAuthenticatedCooperative(cooperativeUserId);

    return prisma.driver.findMany({
      where: { cooperativeId: cooperative.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(cooperativeUserId: string, driverId: string) {
    const cooperative = await this.getAuthenticatedCooperative(cooperativeUserId);

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

  async getMe(userId: string) {
    const driver = await prisma.driver.findFirst({
      where: { userId },
      include: {
        cooperative: true,
        user: true,
      },
    });

    if (!driver) {
      throw new Error("Motorista autenticado não encontrado.");
    }

    return driver;
  }

  async updateMe(userId: string, data: UpdateMyDriverProfileInput) {
    const driver = await this.getAuthenticatedDriverByUserId(userId);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          displayName: data.displayName.trim(),
          phone: data.phone?.trim() || null,
        },
      }),
      prisma.driver.update({
        where: { id: driver.id },
        data: {
          name: data.displayName.trim(),
          phone: data.phone?.trim() || null,
          cnh: data.cnh?.trim() || null,
          cnhCategory: data.cnhCategory?.trim().toUpperCase() || null,
          notes: data.notes?.trim() || null,
        },
      }),
    ]);

    return prisma.driver.findUnique({
      where: { id: driver.id },
      include: {
        cooperative: true,
        user: true,
      },
    });
  }

  async createReport(userId: string, data: CreateDriverReportInput) {
    const driver = await this.getAuthenticatedDriverByUserId(userId);

    return prisma.driverReport.create({
      data: {
        driverId: driver.id,
        type: DriverReportType[data.type],
        description: data.description.trim(),
        routeId: data.routeId || null,
        vehicleId: data.vehicleId || null,
        collectionId: data.collectionId || null,
      },
      include: {
        route: true,
        vehicle: true,
        collection: true,
      },
    });
  }

  async listMyReports(userId: string) {
    const driver = await this.getAuthenticatedDriverByUserId(userId);

    return prisma.driverReport.findMany({
      where: { driverId: driver.id },
      include: {
        route: true,
        vehicle: true,
        collection: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}