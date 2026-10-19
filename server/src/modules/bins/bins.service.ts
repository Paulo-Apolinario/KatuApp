import { BinStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { CreateBinInput, UpdateBinInput } from "./bins.schemas";
export class BinError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
async function context(userId: string) {
  const coop = await prisma.cooperative.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!coop) throw new BinError("Cooperativa não identificada.", 403);
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  return {
    cooperativeId: coop.id,
    actorUserId: userId,
    actorName: actor?.displayName || null,
  };
}
const selectCollection = {
  id: true,
  status: true,
  collectedAt: true,
  createdAt: true,
  notes: true,
  collector: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plate: true, model: true } },
  route: { select: { id: true, name: true } },
  collectionMaterials: {
    select: {
      id: true,
      nameSnapshot: true,
      quantity: true,
      unit: true,
      wasteEntry: { select: { id: true } },
    },
  },
} satisfies Prisma.CollectionSelect;
const listingInclude = {
  vehicle: { select: { id: true, plate: true, model: true, status: true } },
  collections: {
    where: { collectedAt: { not: null }, status: { not: "CANCELLED" } },
    orderBy: { collectedAt: "desc" as const },
    take: 1,
    select: { id: true, collectedAt: true },
  },
  _count: {
    select: { events: { where: { kind: "INCIDENT", resolvedAt: null } } },
  },
} satisfies Prisma.BinInclude;
function serialize(bin: any) {
  const last = bin.collections
    ?.filter((c: any) => c.collectedAt)
    .sort(
      (a: any, b: any) => +new Date(b.collectedAt) - +new Date(a.collectedAt),
    )[0];
  return {
    ...bin,
    bin_id: bin.binId,
    bin_type: bin.binType,
    vehicle_id: bin.vehicleId,
    capacity_kg: bin.capacityKg,
    photo_url: bin.photoUrl,
    last_collection_date: last?.collectedAt || bin.lastCollectionDate,
    lastCollectionSource: last
      ? "RECORDED"
      : bin.lastCollectionDate
        ? "LEGACY"
        : "NONE",
    needsPickup: bin.needsPickup || bin.status === "FULL",
    status: bin.status === "FULL" ? "active" : bin.status.toLowerCase(),
    openIncidents: bin._count?.events ?? 0,
  };
}
const mapping: Record<string, string> = {
  bin_id: "binId",
  bin_type: "binType",
  vehicle_id: "vehicleId",
  capacity_kg: "capacityKg",
  last_collection_date: "lastCollectionDate",
};
function toData(input: CreateBinInput | UpdateBinInput) {
  const data: Record<string, any> = {};
  for (const [key, value] of Object.entries(input))
    data[mapping[key] || key] =
      typeof value === "string" ? value.trim() || null : value;
  if (input.status) {
    data.status = (
      input.status === "full" ? "ACTIVE" : input.status.toUpperCase()
    ) as BinStatus;
    if (input.status === "full") data.needsPickup = true;
  }
  if (Object.hasOwn(input, "last_collection_date")) {
    data.lastCollectionDate = input.last_collection_date
      ? new Date(input.last_collection_date)
      : null;
    if (data.lastCollectionDate && data.lastCollectionDate > new Date())
      throw new BinError("A última coleta não pode estar no futuro.");
  }
  if (Object.hasOwn(input, "openingHours"))
    data.openingHours =
      input.openingHours === null ? Prisma.DbNull : input.openingHours;
  if (input.acceptedMaterials)
    data.acceptedMaterials = [...new Set(input.acceptedMaterials)];
  return data;
}
async function owned(db: any, cooperativeId: string, id: string) {
  const bin = await db.bin.findFirst({ where: { id, cooperativeId } });
  if (!bin)
    throw new BinError("PEV não encontrado para esta cooperativa.", 404);
  return bin;
}
async function validateVehicle(
  db: any,
  cooperativeId: string,
  vehicleId?: string | null,
  existing?: string | null,
) {
  if (!vehicleId) return;
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, cooperativeId },
  });
  if (!vehicle || (vehicleId !== existing && vehicle.status !== "ACTIVE"))
    throw new BinError("Selecione um veículo ativo desta cooperativa.", 409);
}
function capacity(data: any, current?: any) {
  if (
    Object.hasOwn(data, "capacityValue") ||
    Object.hasOwn(data, "capacityUnit")
  ) {
    const value = Object.hasOwn(data, "capacityValue")
      ? data.capacityValue
      : current?.capacityValue;
    const unit = Object.hasOwn(data, "capacityUnit")
      ? data.capacityUnit
      : current?.capacityUnit;
    if ((value == null) !== (unit == null))
      throw new BinError("Informe a capacidade e sua unidade juntas.");
    data.capacityKg = unit === "KG" ? value : null;
  } else if (Object.hasOwn(data, "capacityKg")) {
    data.capacityValue = data.capacityKg;
    data.capacityUnit = data.capacityKg == null ? null : "KG";
  }
}
export const binsService = {
  async list(userId: string) {
    const { cooperativeId } = await context(userId);
    return (
      await prisma.bin.findMany({
        where: { cooperativeId },
        include: listingInclude,
        orderBy: { createdAt: "desc" },
      })
    ).map(serialize);
  },
  async findById(userId: string, id: string) {
    const { cooperativeId } = await context(userId);
    await owned(prisma, cooperativeId, id);
    const bin = await prisma.bin.findUniqueOrThrow({
      where: { id },
      include: {
        ...listingInclude,
        collections: {
          select: selectCollection,
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
    const last = await prisma.collection.findFirst({
      where: {
        binId: id,
        cooperativeId,
        collectedAt: { not: null },
        status: { not: "CANCELLED" },
      },
      orderBy: { collectedAt: "desc" },
      select: { collectedAt: true },
    });
    return {
      ...serialize(bin),
      last_collection_date: last?.collectedAt || bin.lastCollectionDate,
      lastCollectionSource: last
        ? "RECORDED"
        : bin.lastCollectionDate
          ? "LEGACY"
          : "NONE",
    };
  },
  async withdrawals(userId: string, id: string, page = 1) {
    const { cooperativeId } = await context(userId);
    await owned(prisma, cooperativeId, id);
    const where = { binId: id, cooperativeId };
    const [collections, total, totals] = await prisma.$transaction([
      prisma.collection.findMany({
        where,
        select: selectCollection,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 20,
        take: 20,
      }),
      prisma.collection.count({ where }),
      prisma.collectionMaterial.groupBy({
        by: ["unit"],
        orderBy: { unit: "asc" },
        where: {
          collection: {
            binId: id,
            cooperativeId,
            status: { not: "CANCELLED" },
          },
        },
        _sum: { quantity: true },
      }),
    ]);
    return {
      collections,
      pagination: { page, limit: 20, total },
      totals: totals.map((t) => ({ unit: t.unit, quantity: t._sum?.quantity })),
    };
  },
  async events(userId: string, id: string, page = 1) {
    const { cooperativeId } = await context(userId);
    await owned(prisma, cooperativeId, id);
    const where = { binId: id, cooperativeId };
    const [events, total] = await prisma.$transaction([
      prisma.binEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 20,
        take: 20,
      }),
      prisma.binEvent.count({ where }),
    ]);
    return { events, pagination: { page, limit: 20, total } };
  },
  async create(userId: string, input: CreateBinInput) {
    const ctx = await context(userId);
    const data = toData(input);
    capacity(data);
    return prisma.$transaction(async (tx) => {
      await validateVehicle(tx, ctx.cooperativeId, input.vehicle_id);
      const bin = await tx.bin.create({
        data: {
          ...data,
          cooperativeId: ctx.cooperativeId,
        } as Prisma.BinUncheckedCreateInput,
      });
      await tx.binEvent.create({
        data: {
          ...ctx,
          binId: bin.id,
          kind: "CREATED",
          notes: "Cadastro do PEV registrado.",
        },
      });
      return serialize(bin);
    });
  },
  async update(userId: string, id: string, input: UpdateBinInput) {
    const ctx = await context(userId);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Bin" WHERE id = ${id} AND "cooperativeId" = ${ctx.cooperativeId} FOR UPDATE`;
      const current = await owned(tx, ctx.cooperativeId, id);
      await validateVehicle(
        tx,
        ctx.cooperativeId,
        input.vehicle_id,
        current.vehicleId,
      );
      const data = toData(input);
      capacity(data, current);
      const bin = await tx.bin.update({ where: { id }, data });
      const fields = Object.keys(data).filter(
        (key) => JSON.stringify(data[key]) !== JSON.stringify(current[key]),
      );
      if (fields.length)
        await tx.binEvent.create({
          data: {
            ...ctx,
            binId: id,
            kind: "UPDATED",
            notes: "Dados do PEV atualizados.",
            data: { fields },
          },
        });
      return serialize(bin);
    });
  },
  async photo(userId: string, id: string, url: string | null) {
    const ctx = await context(userId);
    await owned(prisma, ctx.cooperativeId, id);
    return prisma.$transaction(async (tx) => {
      const bin = await tx.bin.update({
        where: { id },
        data: { photoUrl: url },
      });
      await tx.binEvent.create({
        data: {
          ...ctx,
          binId: id,
          kind: "PHOTO",
          notes: url ? "Foto atualizada." : "Foto removida do cadastro.",
        },
      });
      return serialize(bin);
    });
  },
  async event(
    userId: string,
    id: string,
    input: {
      kind: "INSPECTION" | "INCIDENT";
      notes: string;
      condition?: string;
      needsPickup?: boolean;
    },
  ) {
    const ctx = await context(userId);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Bin" WHERE id = ${id} AND "cooperativeId" = ${ctx.cooperativeId} FOR UPDATE`;
      await owned(tx, ctx.cooperativeId, id);
      if (input.kind === "INSPECTION")
        await tx.bin.update({
          where: { id },
          data: {
            inspectionAt: new Date(),
            ...(input.needsPickup !== undefined
              ? {
                  needsPickup: input.needsPickup,
                  pickupReason: input.needsPickup ? input.notes : null,
                }
              : {}),
          },
        });
      return tx.binEvent.create({
        data: {
          ...ctx,
          binId: id,
          kind: input.kind,
          notes: input.notes,
          data: {
            condition: input.condition || null,
            needsPickup: input.needsPickup ?? null,
          },
        },
      });
    });
  },
  async resolve(userId: string, id: string, eventId: string) {
    const ctx = await context(userId);
    await owned(prisma, ctx.cooperativeId, id);
    const found = await prisma.binEvent.findFirst({
      where: {
        id: eventId,
        binId: id,
        cooperativeId: ctx.cooperativeId,
        kind: "INCIDENT",
      },
    });
    if (!found) throw new BinError("Ocorrência não encontrada.", 404);
    const r = await prisma.binEvent.updateMany({
      where: {
        id: eventId,
        binId: id,
        cooperativeId: ctx.cooperativeId,
        resolvedAt: null,
      },
      data: { resolvedAt: new Date(), resolvedByUserId: userId },
    });
    if (!r.count) throw new BinError("Esta ocorrência já foi resolvida.", 409);
    return { id: eventId };
  },
  async pickup(
    userId: string,
    id: string,
    input: {
      collectorId: string;
      routeId?: string | null;
      notes?: string | null;
    },
  ) {
    const ctx = await context(userId);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Bin" WHERE id = ${id} AND "cooperativeId" = ${ctx.cooperativeId} FOR UPDATE`;
      const bin = await owned(tx, ctx.cooperativeId, id);
      if (bin.status !== "ACTIVE" && bin.status !== "FULL")
        throw new BinError("Ative o PEV antes de solicitar uma retirada.", 409);
      const pending = await tx.collection.findFirst({
        where: { binId: id, status: { in: ["PENDING", "IN_PROGRESS"] } },
      });
      if (pending)
        throw new BinError(
          "Já existe uma retirada pendente ou em andamento para este PEV.",
          409,
        );
      const collector = await tx.collector.findFirst({
        where: {
          id: input.collectorId,
          cooperativeId: ctx.cooperativeId,
          status: "AVAILABLE",
        },
      });
      if (!collector)
        throw new BinError(
          "O catador não está disponível nesta cooperativa.",
          409,
        );
      let vehicleId = bin.vehicleId,
        driverId: string | null = null,
        routeId: string | null = null;
      if (input.routeId) {
        const route = await tx.route.findFirst({
          where: {
            id: input.routeId,
            cooperativeId: ctx.cooperativeId,
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          },
        });
        if (!route)
          throw new BinError("Rota indisponível nesta cooperativa.", 409);
        routeId = route.id;
        vehicleId = route.vehicleId;
        driverId = route.driverId;
      }
      if (vehicleId) {
        const v = await tx.vehicle.findFirst({
          where: {
            id: vehicleId,
            cooperativeId: ctx.cooperativeId,
            status: "ACTIVE",
          },
        });
        if (!v)
          throw new BinError(
            "Veículo inativo ou em manutenção. Atualize o vínculo ou a rota.",
            409,
          );
        if (driverId && v.driverId && v.driverId !== driverId)
          throw new BinError(
            "Motorista incompatível com o veículo da rota.",
            409,
          );
        driverId = driverId || v.driverId;
      }
      if (driverId) {
        const driver = await tx.driver.findFirst({
          where: {
            id: driverId,
            cooperativeId: ctx.cooperativeId,
            status: { not: "INACTIVE" },
          },
        });
        if (!driver || (driver.status === "ON_ROUTE" && !routeId))
          throw new BinError("Motorista indisponível para esta retirada.", 409);
      }
      const collection = await tx.collection.create({
        data: {
          cooperativeId: ctx.cooperativeId,
          binId: id,
          collectorId: collector.id,
          routeId,
          vehicleId,
          driverId,
          status: "PENDING",
          notes: input.notes || null,
        },
      });
      await tx.bin.update({ where: { id }, data: { needsPickup: true } });
      await tx.binEvent.create({
        data: {
          ...ctx,
          binId: id,
          kind: "PICKUP_REQUESTED",
          notes: input.notes,
          data: { collectionId: collection.id },
        },
      });
      return collection;
    });
  },
  async remove(userId: string, id: string) {
    return this.update(userId, id, { status: "inactive" });
  },
};
