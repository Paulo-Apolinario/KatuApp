import { RouteStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  CreateRouteInput,
  UpdateRouteStatusInput,
} from "./route.schemas";

export class RouteService {
  async create(cooperativeUserId: string, data: CreateRouteInput) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
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

    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          cooperativeId: cooperative.id,
        },
      });

      if (!vehicle) {
        throw new Error("Veículo não encontrado para esta cooperativa.");
      }
    }

    if (data.driverId && data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicleId,
          cooperativeId: cooperative.id,
        },
      });

      if (vehicle?.driverId && vehicle.driverId !== data.driverId) {
        throw new Error("Este veículo já está vinculado a outro motorista.");
      }
    }

    return prisma.route.create({
      data: {
        cooperativeId: cooperative.id,
        driverId: data.driverId || null,
        vehicleId: data.vehicleId || null,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        stops: data.stops ?? [],
        status: data.status
          ? RouteStatus[data.status]
          : RouteStatus.SCHEDULED,
      },
      include: {
        driver: true,
        vehicle: true,
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

    return prisma.route.findMany({
      where: { cooperativeId: cooperative.id },
      include: {
        driver: true,
        vehicle: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(cooperativeUserId: string, routeId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const route = await prisma.route.findFirst({
      where: {
        id: routeId,
        cooperativeId: cooperative.id,
      },
      include: {
        driver: true,
        vehicle: true,
      },
    });

    if (!route) {
      throw new Error("Rota não encontrada.");
    }

    return route;
  }

  async updateStatus(
    cooperativeUserId: string,
    routeId: string,
    data: UpdateRouteStatusInput
  ) {
    const route = await this.findById(cooperativeUserId, routeId);

    return prisma.route.update({
      where: { id: route.id },
      data: {
        status: RouteStatus[data.status],
      },
      include: {
        driver: true,
        vehicle: true,
      },
    });
  }
}