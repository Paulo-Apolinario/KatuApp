import { MaintenanceStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type {
  CreateMaintenanceLogInput,
  UpdateMaintenanceLogInput,
} from "./maintenance-logs.schemas";

function toDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function normalizeStatus(status?: string | null): MaintenanceStatus {
  const value = String(status || "completed").toUpperCase();

  if (value === "COMPLETED") return MaintenanceStatus.COMPLETED;
  if (value === "PENDING") return MaintenanceStatus.PENDING;
  if (value === "SCHEDULED") return MaintenanceStatus.SCHEDULED;
  if (value === "OVERDUE") return MaintenanceStatus.OVERDUE;

  return MaintenanceStatus.COMPLETED;
}

async function getCooperativeId(userId: string) {
  const cooperative = await prisma.cooperative.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!cooperative) {
    throw new Error("Cooperativa não encontrada para o usuário autenticado.");
  }

  return cooperative.id;
}

export const maintenanceLogsService = {
  async list(userId: string) {
    const cooperativeId = await getCooperativeId(userId);

    const logs = await prisma.maintenanceLog.findMany({
      where: { cooperativeId },
      include: {
        vehicle: true,
        cooperative: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return logs.map((log) => ({
      id: log.id,
      cooperative_id: log.cooperativeId,
      vehicle_id: log.vehicleId,
      vehicle: log.vehicle,
      cooperative: log.cooperative,
      maintenance_type: log.maintenanceType,
      maintenance_date: log.maintenanceDate,
      location: log.location,
      cost: log.cost,
      performed_by: log.performedBy,
      next_maintenance_date: log.nextMaintenanceDate,
      notes: log.notes,
      note: log.notes,
      file: log.fileUrl,
      file_url: log.fileUrl,
      status: String(log.status).toLowerCase(),
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    }));
  },

  async findById(userId: string, id: string) {
    const cooperativeId = await getCooperativeId(userId);

    const log = await prisma.maintenanceLog.findFirst({
      where: {
        id,
        cooperativeId,
      },
      include: {
        vehicle: true,
        cooperative: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!log) {
      throw new Error("Manutenção não encontrada.");
    }

    return {
      id: log.id,
      cooperative_id: log.cooperativeId,
      vehicle_id: log.vehicleId,
      vehicle: log.vehicle,
      cooperative: log.cooperative,
      maintenance_type: log.maintenanceType,
      maintenance_date: log.maintenanceDate,
      location: log.location,
      cost: log.cost,
      performed_by: log.performedBy,
      next_maintenance_date: log.nextMaintenanceDate,
      notes: log.notes,
      note: log.notes,
      file: log.fileUrl,
      file_url: log.fileUrl,
      status: String(log.status).toLowerCase(),
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    };
  },

  async create(userId: string, data: CreateMaintenanceLogInput, fileUrl?: string | null) {
    const cooperativeId = await getCooperativeId(userId);

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: data.vehicle_id,
        cooperativeId,
      },
    });

    if (!vehicle) {
      throw new Error("Veículo não encontrado para esta cooperativa.");
    }

    const maintenanceDate = toDate(data.maintenance_date);

    if (!maintenanceDate) {
      throw new Error("Data da manutenção inválida.");
    }

    return prisma.maintenanceLog.create({
      data: {
        cooperativeId,
        vehicleId: data.vehicle_id,
        maintenanceType: data.maintenance_type,
        maintenanceDate,
        location: data.location || null,
        cost: data.cost || null,
        performedBy: data.performed_by || null,
        nextMaintenanceDate: toDate(data.next_maintenance_date),
        notes: data.notes || null,
        fileUrl: fileUrl || null,
        status: normalizeStatus(data.status),
      },
    });
  },

  async update(
    userId: string,
    id: string,
    data: UpdateMaintenanceLogInput,
    fileUrl?: string | null
  ) {
    const cooperativeId = await getCooperativeId(userId);

    const current = await prisma.maintenanceLog.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!current) {
      throw new Error("Manutenção não encontrada.");
    }

    if (data.vehicle_id) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: data.vehicle_id,
          cooperativeId,
        },
      });

      if (!vehicle) {
        throw new Error("Veículo não encontrado para esta cooperativa.");
      }
    }

    return prisma.maintenanceLog.update({
      where: { id },
      data: {
        vehicleId: data.vehicle_id ?? current.vehicleId,
        maintenanceType: data.maintenance_type ?? current.maintenanceType,
        maintenanceDate:
          data.maintenance_date === undefined
            ? current.maintenanceDate
            : toDate(data.maintenance_date) || current.maintenanceDate,
        location: data.location === undefined ? current.location : data.location || null,
        cost: data.cost === undefined ? current.cost : data.cost || null,
        performedBy:
          data.performed_by === undefined ? current.performedBy : data.performed_by || null,
        nextMaintenanceDate:
          data.next_maintenance_date === undefined
            ? current.nextMaintenanceDate
            : toDate(data.next_maintenance_date),
        notes: data.notes === undefined ? current.notes : data.notes || null,
        fileUrl: fileUrl || current.fileUrl,
        status: data.status ? normalizeStatus(data.status) : current.status,
      },
    });
  },

  async remove(userId: string, id: string) {
    const cooperativeId = await getCooperativeId(userId);

    const current = await prisma.maintenanceLog.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!current) {
      throw new Error("Manutenção não encontrada.");
    }

    await prisma.maintenanceLog.delete({
      where: { id },
    });

    return true;
  },
};