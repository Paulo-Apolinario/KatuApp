import { BinStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { CreateBinInput, UpdateBinInput } from "./bins.schemas";

function normalizeStatus(status?: string | null): BinStatus {
  const value = String(status || "active").toUpperCase();

  if (value === "ACTIVE") return BinStatus.ACTIVE;
  if (value === "INACTIVE") return BinStatus.INACTIVE;
  if (value === "FULL") return BinStatus.FULL;
  if (value === "MAINTENANCE") return BinStatus.MAINTENANCE;

  return BinStatus.ACTIVE;
}

function toDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
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

export const binsService = {
  async list(userId: string) {
    const cooperativeId = await getCooperativeId(userId);

    const bins = await prisma.bin.findMany({
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

    return bins.map((bin) => ({
      id: bin.id,
      bin_id: bin.binId,
      bin_type: bin.binType,
      location: bin.location,
      vehicle_id: bin.vehicleId,
      vehicle: bin.vehicle,
      capacity_kg: bin.capacityKg,
      notes: bin.notes,
      photo_url: bin.photoUrl,
      last_collection_date: bin.lastCollectionDate,
      status: String(bin.status).toLowerCase(),
      createdAt: bin.createdAt,
      updatedAt: bin.updatedAt,
    }));
  },

  async findById(userId: string, id: string) {
    const cooperativeId = await getCooperativeId(userId);

    const bin = await prisma.bin.findFirst({
      where: {
        id,
        cooperativeId,
      },
      include: {
        vehicle: true,
      },
    });

    if (!bin) {
      throw new Error("Lixeira não encontrada.");
    }

    return {
      id: bin.id,
      bin_id: bin.binId,
      bin_type: bin.binType,
      location: bin.location,
      vehicle_id: bin.vehicleId,
      vehicle: bin.vehicle,
      capacity_kg: bin.capacityKg,
      notes: bin.notes,
      photo_url: bin.photoUrl,
      last_collection_date: bin.lastCollectionDate,
      status: String(bin.status).toLowerCase(),
      createdAt: bin.createdAt,
      updatedAt: bin.updatedAt,
    };
  },

  async create(userId: string, data: CreateBinInput) {
    const cooperativeId = await getCooperativeId(userId);

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

    const created = await prisma.bin.create({
      data: {
        cooperativeId,
        vehicleId: data.vehicle_id || null,
        binId: data.bin_id,
        binType: data.bin_type || null,
        location: data.location || null,
        capacityKg: data.capacity_kg || null,
        notes: data.notes || null,
        photoUrl: data.photo_url || null,
        lastCollectionDate: toDate(data.last_collection_date),
        status: normalizeStatus(data.status),
      },
    });

    return created;
  },

  async update(userId: string, id: string, data: UpdateBinInput) {
    const cooperativeId = await getCooperativeId(userId);

    const current = await prisma.bin.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!current) {
      throw new Error("Lixeira não encontrada.");
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

    const updated = await prisma.bin.update({
      where: { id },
      data: {
        binId: data.bin_id ?? current.binId,
        binType: data.bin_type ?? current.binType,
        location: data.location ?? current.location,
        vehicleId: data.vehicle_id === undefined ? current.vehicleId : data.vehicle_id || null,
        capacityKg:
          data.capacity_kg === undefined ? current.capacityKg : data.capacity_kg || null,
        notes: data.notes === undefined ? current.notes : data.notes || null,
        photoUrl: data.photo_url === undefined ? current.photoUrl : data.photo_url || null,
        lastCollectionDate:
          data.last_collection_date === undefined
            ? current.lastCollectionDate
            : toDate(data.last_collection_date),
        status: data.status ? normalizeStatus(data.status) : current.status,
      },
    });

    return updated;
  },

  async remove(userId: string, id: string) {
    const cooperativeId = await getCooperativeId(userId);

    const current = await prisma.bin.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!current) {
      throw new Error("Lixeira não encontrada.");
    }

    await prisma.bin.delete({
      where: { id },
    });

    return true;
  },
};