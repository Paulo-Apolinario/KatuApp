import { generateStockCode } from "../waste-stock/stock-codes";
import { collectionReferenceWhere } from "../collections/collection-reference";
import {
  listFieldPoints,
  listFieldRoutes,
  routeFieldPoints,
} from "./field-operations.service";
import type { FastifyInstance } from "fastify";
import { Prisma, WasteUnit } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { catalogNameKey, pagination } from "./waste-workspace.model";
const query = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(150).default(""),
    view: z.enum(["current", "history", "catalog", "closed"]).default("current"),
    stage: z
      .enum([
        "all",
        "receipt",
        "review",
        "destination",
        "follow-up",
        "ready",
        "completed",
        "cancelled",
      ])
      .default("all"),
    unit: z.nativeEnum(WasteUnit).optional(),
    status: z.string().max(30).optional(),
    category: z.string().max(100).optional(),
    itemId: z.string().max(100).optional(),
    origin: z.enum(["PEV", "GENERATOR", "EXTRA", "OTHER"]).optional(),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();
const itemSelect = {
  id: true,
  name: true,
  category: true,
  subcategory: true,
  unit: true,
  defaultUnit: true,
  status: true,
  isActive: true,
  internalCode: true,
  wasteClass: true,
  description: true,
} as const;
function failure(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
export async function wasteCooperativeScope(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      accountStatus: true,
      cooperative: { select: { id: true } },
    },
  });
  if (
    !u?.isActive ||
    u.accountStatus !== "ACTIVE" ||
    u.role !== "COOPERATIVE" ||
    !u.cooperative
  )
    failure("Acesso restrito à cooperativa ativa.", 403);
  return u.cooperative.id;
}
function dates(q: z.infer<typeof query>) {
  const from = q.dateFrom
      ? new Date(q.dateFrom + "T00:00:00-03:00")
      : undefined,
    to = q.dateTo ? new Date(q.dateTo + "T23:59:59.999-03:00") : undefined;
  if (
    (from && !Number.isFinite(+from)) ||
    (to && !Number.isFinite(+to)) ||
    (from && to && from > to)
  )
    failure("Período inválido.", 400);
  for (const day of [q.dateFrom, q.dateTo])
    if (day && new Date(day + "T12:00:00Z").toISOString().slice(0, 10) !== day)
      failure("Data inexistente no calendário.", 400);
  return from || to ? { gte: from, lte: to } : undefined;
}
function collectionWhere(
  id: string,
  q: z.infer<typeof query>,
): Prisma.CollectionWhereInput {
  const conditions: Prisma.CollectionWhereInput[] = [{ cooperativeId: id }];
  const openMovement = {
    destinations: {
      some: {
        status: "ACTIVE" as const,
        type: { in: ["TRIAGE" as const, "RESERVATION" as const] },
      },
    },
  };
  switch (q.stage) {
    case "receipt":
      conditions.push({ status: "COLLECTED" });
      break;
    case "review":
      conditions.push({
        status: { in: ["RECEIVED", "SORTING"] },
        quantityReviewVersion: 0,
      });
      break;
    case "destination":
      conditions.push({
        status: { in: ["RECEIVED", "SORTING", "COMPLETED"] },
        quantityReviewVersion: { gt: 0 },
        collectionWasteEntries: { some: { OR: [{ remainingQuantity: { gt: 0 } }, openMovement] } },
      });
      break;
    case "ready":
      conditions.push({ status: { in: ["RECEIVED", "SORTING"] }, quantityReviewVersion: { gt: 0 },
        collectionWasteEntries: { some: {}, none: { remainingQuantity: { gt: 0 } } } });
      break;
    case "follow-up":
      conditions.push({ status: { in: ["RECEIVED", "SORTING", "COMPLETED"] },
        collectionWasteEntries: { some: { OR: [openMovement, { destinations: { some: { status: "ACTIVE", type: "STOCK", stockLot: { is: { status: { in: ["AVAILABLE", "RESERVED"] }, availableQuantity: { gt: 0 } } } } } }] } } });
      break;
    case "completed":
      conditions.push({ status: "COMPLETED" });
      break;
    case "cancelled":
      conditions.push({ status: "CANCELLED" });
      break;
    default:
      conditions.push({
        status: { in: ["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"] },
      });
  }
  if (q.origin === "PEV") conditions.push({ binId: { not: null } });
  if (q.origin === "GENERATOR")
    conditions.push({ generatorId: { not: null }, extraOrder: { is: null } });
  if (q.origin === "EXTRA") conditions.push({ extraOrder: { isNot: null } });
  if (q.origin === "OTHER")
    conditions.push({
      binId: null,
      generatorId: null,
      extraOrder: { is: null },
    });
  if (q.unit)
    conditions.push({ collectionMaterials: { some: { unit: q.unit } } });
  const period = dates(q);
  if (period) conditions.push({ collectedAt: period });
  if (q.q)
    conditions.push({
      OR: [
        ...collectionReferenceWhere(q.q),
        { generator: { name: { contains: q.q, mode: "insensitive" } } },
        { bin: { name: { contains: q.q, mode: "insensitive" } } },
        { collector: { name: { contains: q.q, mode: "insensitive" } } },
        { route: { name: { contains: q.q, mode: "insensitive" } } },
        {
          collectionMaterials: {
            some: { nameSnapshot: { contains: q.q, mode: "insensitive" } },
          },
        },
      ],
    });
  return { AND: conditions };
}
export async function wasteWorkspaceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  const handle =
    (fn: (id: string, r: any) => Promise<unknown>) =>
    async (r: any, p: any) => {
      try {
        p.header("Cache-Control", "private, no-store");
        const id = await wasteCooperativeScope(r.user.sub);
        return await fn(id, r);
      } catch (e: any) {
        if (e instanceof z.ZodError)
          return p
            .code(400)
            .send({ error: e.issues.map((x) => x.message).join(" ") });
        if (e.code === "P2002")
          return p.code(409).send({
            error:
              "Material já cadastrado. Atualize o catálogo e selecione o existente.",
          });
        if (e.statusCode)
          return p.code(e.statusCode).send({ error: e.message });
        r.log.error({ code: e.code }, "Falha na gestão de resíduos");
        return p
          .code(500)
          .send({ error: "Não foi possível consultar a gestão de resíduos." });
      }
    };
  app.get(
    "/waste-workspace/field-options",
    handle(async (id) => {
      const [generator, collector, driver, vehicle, route] =
        await prisma.$transaction([
          prisma.generator.findMany({
            where: { cooperativeId: id },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          prisma.collector.findMany({
            where: { cooperativeId: id },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          prisma.driver.findMany({
            where: { cooperativeId: id },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          prisma.vehicle.findMany({
            where: { cooperativeId: id },
            select: { id: true, plate: true },
            orderBy: { plate: "asc" },
          }),
          prisma.route.findMany({
            where: { cooperativeId: id },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
        ]);
      return { generator, collector, driver, vehicle, route };
    }),
  );
  app.get(
    "/waste-workspace/field-collections",
    handle(async (id, r) => listFieldPoints(id, r.query)),
  );
  app.get(
    "/waste-workspace/field-routes",
    handle(async (id, r) => listFieldRoutes(id, r.query)),
  );
  app.get(
    "/waste-workspace/field-routes/:id/collections",
    handle(async (id, r) =>
      routeFieldPoints(
        id,
        z.object({ id: z.string().min(1).max(100) }).parse(r.params).id,
        r.query,
      ),
    ),
  );
  app.get(
    "/waste-workspace/collections",
    handle(async (id, r) => {
      const q = query.parse(r.query),
        where = collectionWhere(id, q),
        ew: Prisma.CollectionWasteEntryWhereInput = {
          cooperativeId: id,
          collection: where,
        };
      const [collections, total, units] = await prisma.$transaction([
        prisma.collection.findMany({
          where,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
          orderBy: [{ collectedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            scheduleId: true,
            routePoint: true,
            schedule: { select: { pickupAddress: true, requestedBy: { select: { displayName: true } } } },
            status: true,
            collectedAt: true,
            receivedAt: true,
            createdAt: true,
            quantityReviewVersion: true,
            bin: { select: { id: true, name: true, binId: true } },
            generator: { select: { id: true, name: true, companyName: true } },
            collector: { select: { name: true } },
            route: { select: { name: true } },
            extraOrder: { select: { id: true } },
            collectionWasteEntries: {
              select: {
                id: true,
                unit: true,
                materialNameSnapshot: true,
                collectedQuantity: true,
                destinedQuantity: true,
                remainingQuantity: true,
                status: true,
                wasteTypeId: true,
                destinations: {
                  where: {
                    status: "ACTIVE",
                  },
                  select: { id: true, type: true, quantity: true, destinationName: true, destinationDate: true,
                    stockLot: { select: { id: true, code: true, lotCode: true, status: true, availableQuantity: true,
                      movements: { where: { kind: { in: ["SALE", "DONATION", "DIRECT_DESTINATION", "DISPOSAL"] } }, orderBy: [{ movementDate: "desc" }, { id: "desc" }], take: 5, select: { id: true, kind: true, quantity: true, destinationName: true, movementDate: true } },
                      _count: { select: { movements: true } },
                    } } },
                },
              },
            },
          },
        }),
        prisma.collection.count({ where }),
        prisma.collectionWasteEntry.groupBy({
          by: ["unit"],
          orderBy: { unit: "asc" },
          where: ew,
          _sum: {
            collectedQuantity: true,
            destinedQuantity: true,
            remainingQuantity: true,
          },
        }),
      ]);
      return {
        collections,
        pagination: pagination(q.page, q.limit, total),
        units: units.map((x) => ({ unit: x.unit, ...x._sum })),
      };
    }),
  );
  app.get(
    "/waste-workspace/inventory",
    handle(async (id, r) => {
      const q = query.parse(r.query),
        lotWhere: Prisma.WasteStockLotWhereInput = {
          cooperativeId: id,
          status:
            q.view === "history"
              ? "CANCELLED"
              : q.view === "closed" ? { in: ["SOLD", "DESTINED", "DISCARDED"] }
              : q.view === "catalog"
                ? { not: "CANCELLED" }
                : { in: ["AVAILABLE", "RESERVED"] },
        };
      if (q.status && q.view !== "catalog")
        lotWhere.status = z
          .enum(["AVAILABLE", "RESERVED", "SOLD", "DESTINED", "DISCARDED", "CANCELLED"])
          .parse(q.status);
      const where: Prisma.WasteStockItemWhereInput = {
        cooperativeId: id,
        ...(q.itemId ? { id: q.itemId } : {}),
        ...(q.unit ? { unit: q.unit } : {}),
        ...(q.category
          ? { category: { equals: q.category, mode: "insensitive" } }
          : {}),
        ...(q.q
          ? {
              OR: [
                { name: { contains: q.q, mode: "insensitive" } },
                { category: { contains: q.q, mode: "insensitive" } },
                { internalCode: { contains: q.q, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      if (q.view === "catalog" && q.status)
        where.status = z.enum(["ACTIVE", "INACTIVE"]).parse(q.status);
      if (q.view !== "catalog") where.lots = { some: lotWhere };
      const balancesWhere: Prisma.WasteStockLotWhereInput = {
        ...lotWhere,
        stockItem: where,
      };
      const [items, total, balances, lotCount] = await prisma.$transaction([
        prisma.wasteStockItem.findMany({
          where,
          select: {
            ...itemSelect,
            _count: { select: { lots: { where: lotWhere } } },
          },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        }),
        prisma.wasteStockItem.count({ where }),
        prisma.wasteStockLot.groupBy({
          by: ["unit", "status"],
          orderBy: { unit: "asc" },
          where: balancesWhere,
          _sum: { availableQuantity: true, quantity: true },
          _count: true,
        }),
        prisma.wasteStockLot.count({ where: balancesWhere }),
      ]);
      const ids = items.map((i) => i.id);
      const pageBalances = ids.length
        ? await prisma.wasteStockLot.groupBy({
            by: ["stockItemId", "unit", "status"],
            where: { ...lotWhere, stockItemId: { in: ids } },
            _sum: { availableQuantity: true, quantity: true },
          })
        : [];
      return {
        items: items.map((i) => ({
          ...i,
          balances: pageBalances.filter((b) => b.stockItemId === i.id),
        })),
        pagination: pagination(q.page, q.limit, total),
        balances,
        lotCount,
      };
    }),
  );
  app.get(
    "/waste-workspace/items/:id/lots",
    handle(async (id, r) => {
      const q = query.parse(r.query),
        item = await prisma.wasteStockItem.findFirst({
          where: { id: r.params.id, cooperativeId: id },
          select: itemSelect,
        });
      if (!item) failure("Material não encontrado.", 404);
      const where: Prisma.WasteStockLotWhereInput = {
        cooperativeId: id,
        stockItemId: item.id,
        status:
          q.view === "history"
            ? "CANCELLED"
            : q.view === "closed" ? { in: ["SOLD", "DESTINED", "DISCARDED"] }
            : { in: ["AVAILABLE", "RESERVED"] },
      };
      if (q.status && q.view !== "history")
        where.status = z
          .enum(["AVAILABLE", "RESERVED", "SOLD", "DESTINED", "DISCARDED"])
          .parse(q.status);
      const [lots, total] = await prisma.$transaction([
        prisma.wasteStockLot.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        }),
        prisma.wasteStockLot.count({ where }),
      ]);
      return { item, lots, pagination: pagination(q.page, q.limit, total) };
    }),
  );
  app.get(
    "/waste-workspace/lots/:id",
    handle(async (id, r) => {
      const lot = await prisma.wasteStockLot.findFirst({
        where: { id: r.params.id, cooperativeId: id },
        include: { stockItem: { select: itemSelect }, _count: { select: { movements: true } } },
      });
      if (!lot) failure("Lote não encontrado.", 404);
      return { lot };
    }),
  );
  app.get(
    "/waste-workspace/catalog",
    handle(async (id, r) => {
      const q = query.parse(r.query);
      const where: Prisma.WasteStockItemWhereInput = {
        cooperativeId: id,
        isActive: true,
        status: "ACTIVE",
        ...(q.unit ? { unit: q.unit, defaultUnit: q.unit } : {}),
        ...(q.q ? { name: { contains: q.q, mode: "insensitive" } } : {}),
      };
      const [items, total] = await prisma.$transaction([
        prisma.wasteStockItem.findMany({
          where,
          select: itemSelect,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: q.limit,
          skip: (q.page - 1) * q.limit,
        }),
        prisma.wasteStockItem.count({ where }),
      ]);
      return { items, pagination: pagination(q.page, q.limit, total) };
    }),
  );
  app.post(
    "/waste-workspace/entries/:id/catalog",
    handle(async (id, r) => {
      const input = z
        .object({
          existingId: z.string().max(100).optional(),
          name: z.string().trim().min(2).max(255).optional(),
          category: z.string().trim().min(2).max(100).optional(),
          unit: z.nativeEnum(WasteUnit),
        })
        .strict()
        .parse(r.body);
      if (!input.existingId && (!input.name || !input.category))
        failure("Informe nome e categoria do material.", 400);
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT c.id FROM "Collection" c JOIN "CollectionWasteEntry" e ON e."collectionId"=c.id WHERE e.id=${r.params.id} AND c."cooperativeId"=${id} FOR UPDATE OF c`;
        const entry = await tx.collectionWasteEntry.findFirst({
          where: { id: r.params.id, cooperativeId: id },
          include: { collection: true },
        });
        if (!entry) failure("Entrada não encontrada.", 404);
        const pendingMovement = entry.collection.status === "COMPLETED" && !entry.wasteTypeId && await tx.collectionWasteDestination.count({
          where: { collectionWasteEntryId: entry.id, status: "ACTIVE", type: { in: ["TRIAGE", "RESERVATION"] } },
        });
        if (entry.collection.status === "CANCELLED" || (entry.collection.status === "COMPLETED" && !pendingMovement))
          failure("Coleta encerrada: classificação preservada para consulta.");
        if (entry.unit !== input.unit)
          failure("A unidade do material deve ser a mesma da entrada.");
        await tx.$queryRaw`SELECT id FROM "Cooperative" WHERE id=${id} FOR UPDATE`;
        let item = input.existingId
          ? await tx.wasteStockItem.findFirst({
              where: { id: input.existingId, cooperativeId: id },
            })
          : await tx.wasteStockItem.findFirst({
              where: {
                cooperativeId: id,
                OR: [
                  { normalizedName: catalogNameKey(input.name!) },
                  { name: { equals: input.name!, mode: "insensitive" } },
                ],
              },
            });
        if (input.existingId && !item)
          failure("Material não encontrado nesta cooperativa.", 404);
        if (!item)
          item = await tx.wasteStockItem.create({
            data: {
              cooperativeId: id,
              name: input.name!,
              normalizedName: catalogNameKey(input.name!),
              internalCode: generateStockCode("MAT"),
              category: input.category!,
              unit: input.unit,
              defaultUnit: input.unit,
            },
          });
        if (
          item.unit !== entry.unit ||
          item.defaultUnit !== entry.unit ||
          item.status !== "ACTIVE" ||
          !item.isActive
        )
          failure(
            "Já existe material com esse nome, mas sua unidade ou situação não é compatível. Selecione ou revise o cadastro.",
          );
        if (!item.internalCode) item = await tx.wasteStockItem.update({
          where: { id: item.id }, data: { internalCode: generateStockCode("MAT") },
        });
        if (entry.wasteTypeId && entry.wasteTypeId !== item.id)
          failure(
            "A entrada já foi classificada. Atualize antes de alterar o vínculo.",
          );
        await tx.collectionMaterial.update({
          where: { id: entry.collectionMaterialId },
          data: { wasteTypeId: item.id },
        });
        await tx.collectionWasteEntry.update({
          where: { id: entry.id },
          data: { wasteTypeId: item.id },
        });
        await tx.wasteCatalogSuggestion.updateMany({
          where: {
            cooperativeId: id,
            collectionMaterialId: entry.collectionMaterialId,
            status: "PENDING",
          },
          data: {
            status: "APPROVED",
            approvedWasteTypeId: item.id,
            reviewedByUserId: r.user.sub,
            reviewedAt: new Date(),
          },
        });
        return { item, entryId: entry.id };
      });
    }),
  );
}
