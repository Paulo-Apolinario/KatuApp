import { Prisma, UserRole, VehicleStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  CreateVehicleInput,
  UpdateVehicleInput,
  UpdateVehicleStatusInput,
} from "./vehicle.schemas";

function sanitizePlate(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const vehicleInclude = { driver: { select: { id: true, name: true, status: true } } } as const;

export class VehicleService {
  async create(cooperativeUserId: string, data: CreateVehicleInput) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const plate = sanitizePlate(data.plate);

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { plate },
    });

    if (existingVehicle) {
      throw new Error("Já existe veículo com esta placa.");
    }

    if (data.driverId) {
      const driver = await prisma.driver.findFirst({
        where: {
          id: data.driverId,
          cooperativeId: cooperative.id,
        },
      });

      if (!driver) {
        throw new Error("Motorista não encontrado para esta cooperativa.");
      }
    }

    return prisma.vehicle.create({
      include: vehicleInclude,
      data: {
        cooperativeId: cooperative.id,
        driverId: data.driverId || null,
        plate,
        model: data.model.trim(),
        brand: data.brand?.trim() || null,
        year: data.year ?? null,
        capacityKg: data.capacityKg ?? 0,
        status: data.status
          ? VehicleStatus[data.status]
          : VehicleStatus.ACTIVE,
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

    return prisma.vehicle.findMany({
      include: vehicleInclude,
      where: { cooperativeId: cooperative.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async listByAuthenticatedDriver(driverUserId: string) {
    const driver = await prisma.driver.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver) {
      throw new Error("Motorista do usuário autenticado não encontrado.");
    }

    return prisma.vehicle.findMany({
      include: vehicleInclude,
      where: {
        driverId: driver.id,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByIdForCooperative(cooperativeUserId: string, vehicleId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const vehicle = await prisma.vehicle.findFirst({
      include: vehicleInclude,
      where: {
        id: vehicleId,
        cooperativeId: cooperative.id,
      },
    });

    if (!vehicle) {
      throw new Error("Veículo não encontrado.");
    }

    return vehicle;
  }

  async findByIdForDriver(driverUserId: string, vehicleId: string) {
    const driver = await prisma.driver.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver) {
      throw new Error("Motorista do usuário autenticado não encontrado.");
    }

    const vehicle = await prisma.vehicle.findFirst({
      include: vehicleInclude,
      where: {
        id: vehicleId,
        driverId: driver.id,
      },
    });

    if (!vehicle) {
      throw new Error("Veículo não encontrado para este motorista.");
    }

    return vehicle;
  }

  async findById(authUserId: string, authUserRole: string, vehicleId: string) {
    if (authUserRole === UserRole.COOPERATIVE) {
      return this.findByIdForCooperative(authUserId, vehicleId);
    }

    if (authUserRole === UserRole.DRIVER) {
      return this.findByIdForDriver(authUserId, vehicleId);
    }

    throw new Error("Usuário sem permissão para consultar veículo.");
  }

  async update(cooperativeUserId: string, vehicleId: string, data: UpdateVehicleInput) {
    const cooperative = await prisma.cooperative.findUnique({ where: { userId: cooperativeUserId } });
    if (!cooperative) throw new Error("Cooperativa do usuário autenticado não encontrada.");
    return prisma.$transaction(async (transaction) => {
      const vehicle = await transaction.vehicle.findFirst({ where: { id: vehicleId, cooperativeId: cooperative.id } });
      if (!vehicle) throw new Error("Veículo não encontrado.");
      if (data.driverId) {
        const driver = await transaction.driver.findFirst({ where: { id: data.driverId, cooperativeId: cooperative.id } });
        if (!driver) throw new Error("Motorista não encontrado para esta cooperativa.");
      }
      return transaction.vehicle.update({
        where: { id: vehicle.id },
        data: {
          ...data,
          plate: data.plate === undefined ? undefined : sanitizePlate(data.plate),
          brand: data.brand === undefined ? undefined : data.brand?.trim() || null,
        },
        include: vehicleInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateStatus(cooperativeUserId: string, vehicleId: string, data: UpdateVehicleStatusInput) {
    return this.update(cooperativeUserId, vehicleId, data);
  }
}
