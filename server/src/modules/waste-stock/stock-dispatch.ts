import { createHash } from "node:crypto";
import { Prisma, WasteStockLot } from "@prisma/client";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { wasteCooperativeScope } from "../waste-workspace/waste-workspace.routes";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const quantity = z
  .number()
  .positive()
  .max(1e9)
  .refine(
    (v) => new Prisma.Decimal(v).decimalPlaces() <= 3,
    "Use até três casas decimais.",
  );
const planInput = z
  .object({
    stockItemId: z.string().min(1),
    unit: z.enum(["KG", "TON", "LITER", "UNIT", "CUBIC_METER"]),
    quantity,
  })
  .strict();
const dispatchInput = planInput
  .extend({
    operationId: z.string().uuid(),
    expectedPlanHash: z.string().regex(/^[a-f0-9]{64}$/),
    kind: z.enum(["SALE", "DONATION", "DIRECT_DESTINATION", "DISPOSAL"]),
    destinationName: z.string().trim().min(2).max(255),
    destinationDocument: z.string().trim().max(100).default(""),
    destinationAddress: z.string().trim().max(500).default(""),
    transportDriverName: z.string().trim().max(100).default(""),
    transportVehiclePlate: z.string().trim().max(20).default(""),
    transportDocument: z.string().trim().max(255).default(""),
    environmentalDocument: z.string().trim().max(255).default(""),
    notes: z.string().trim().max(1500).default(""),
    movementDate: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(
    (v) => v.kind !== "DISPOSAL" || v.notes.length >= 3,
    "Informe a justificativa do descarte.",
  );
function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
/** Decimal arithmetic: original quantity is never modified; reserved lots are never consumed. */
export function allocateDispatch(lots: WasteStockLot[], requested: number) {
  let remaining = new Prisma.Decimal(requested);
  const allocations: {
    lotId: string;
    lotCode: string;
    version: number;
    before: string;
    quantity: string;
    after: string;
    originCollectionId: string | null;
  }[] = [];
  for (const lot of lots) {
    if (remaining.isZero()) break;
    if (allocations.length === 500)
      fail("A saída excede 500 lotes. Divida em operações menores.", 400);
    const before = new Prisma.Decimal(lot.availableQuantity);
    const take = Prisma.Decimal.min(before, remaining);
    if (take.lte(0)) continue;
    allocations.push({
      lotId: lot.id,
      lotCode: lot.lotCode || lot.code || lot.id,
      version: lot.version,
      before: before.toFixed(3),
      quantity: take.toFixed(3),
      after: before.sub(take).toFixed(3),
      originCollectionId: lot.originCollectionId,
    });
    remaining = remaining.sub(take);
  }
  if (remaining.gt(0))
    fail(
      "Saldo disponível insuficiente nesta unidade. Material reservado não é utilizado.",
    );
  return allocations;
}
const docInclude = {
  orders: { include: { serviceOrder: { select: { number: true } } } },
} as const;
async function document(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  operationId: string,
) {
  return tx.internalDocument.findUnique({
    where: {
      cooperativeId_eventKey: {
        cooperativeId,
        eventKey: `STOCK-DISPATCH:${operationId}`,
      },
    },
    include: docInclude,
  });
}
export async function stockDispatchRoutes(app: FastifyInstance) {
  const handle =
    (fn: (r: any, p: any) => Promise<unknown>) => async (r: any, p: any) => {
      try {
        p.header("Cache-Control", "private, no-store");
        return await fn(r, p);
      } catch (e: any) {
        const conflict = ["P2002", "P2034"].includes(e.code);
        if (!e.statusCode && !(e instanceof z.ZodError) && !conflict)
          r.log.error(e);
        return p
          .code(
            e instanceof z.ZodError
              ? 400
              : conflict
                ? 409
                : e.statusCode || 500,
          )
          .send({
            error:
              e instanceof z.ZodError
                ? e.issues.map((i) => i.message).join(" ")
                : e.statusCode
                  ? e.message
                  : conflict
                    ? "O estoque mudou. Confira o protocolo e atualize a prévia."
                    : "Não foi possível registrar a saída. Confira o protocolo antes de repetir.",
          });
      }
    };
  const candidates = async (
    tx: Prisma.TransactionClient,
    cooperativeId: string,
    data: z.infer<typeof planInput>,
  ) =>
    tx.wasteStockLot.findMany({
      where: {
        cooperativeId,
        stockItemId: data.stockItemId,
        unit: data.unit,
        status: "AVAILABLE",
        availableQuantity: { gt: 0 },
      },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      take: 501,
    });
  const plan = (data: z.infer<typeof planInput>, lots: WasteStockLot[]) => {
    const allocations = allocateDispatch(lots, data.quantity);
    return {
      stockItemId: data.stockItemId,
      unit: data.unit,
      quantity: new Prisma.Decimal(data.quantity).toFixed(3),
      allocations,
      planHash: hash({
        stockItemId: data.stockItemId,
        unit: data.unit,
        quantity: data.quantity,
        allocations,
      }),
    };
  };
  app.post(
    "/dispatches/preview",
    handle(async (r) => {
      const cooperativeId = await wasteCooperativeScope(r.user.sub),
        data = planInput.parse(r.body);
      return prisma.$transaction(async (tx) => {
        const item = await tx.wasteStockItem.findFirst({
          where: { id: data.stockItemId, cooperativeId },
          select: { name: true },
        });
        if (!item) fail("Material não encontrado.", 404);
        return {
          ...plan(data, await candidates(tx, cooperativeId, data)),
          materialName: item.name,
        };
      });
    }),
  );
  app.get(
    "/dispatches/:operationId",
    handle(async (r) => {
      const cooperativeId = await wasteCooperativeScope(r.user.sub),
        operationId = z.string().uuid().parse(r.params.operationId);
      const found = await document(prisma, cooperativeId, operationId);
      if (!found) fail("Saída não registrada para este protocolo.", 404);
      return { document: found };
    }),
  );
  app.post(
    "/dispatches",
    handle(async (r, p) => {
      const cooperativeId = await wasteCooperativeScope(r.user.sub),
        data = dispatchInput.parse(r.body),
        operationHash = hash(data);
      const result = await prisma.$transaction(
        async (tx) => {
          // Operation lock makes a lost-response retry safe, including concurrent submissions.
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`stock-operation:${cooperativeId}:${data.operationId}`}))`;
          const previous = await document(tx, cooperativeId, data.operationId);
          if (previous) {
            const saved = previous.snapshot as any;
            if (
              saved.operationHash !== operationHash ||
              saved.actorUserId !== r.user.sub
            )
              fail("Protocolo reutilizado com outros dados.");
            return { document: previous, replayed: true };
          }
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`stock-material:${cooperativeId}:${data.stockItemId}:${data.unit}`}))`;
          const lots = await candidates(tx, cooperativeId, data);
          // Match existing movement lock order: origin collections first, then lots.
          const origins = [
            ...new Set(
              lots
                .map((l) => l.originCollectionId)
                .filter((id): id is string => !!id),
            ),
          ].sort();
          for (const id of origins)
            await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${id} AND "cooperativeId"=${cooperativeId} FOR UPDATE`;
          for (const id of lots.map((l) => l.id).sort())
            await tx.$queryRaw`SELECT id FROM "WasteStockLot" WHERE id=${id} AND "cooperativeId"=${cooperativeId} FOR UPDATE`;
          const locked = await tx.wasteStockLot.findMany({
            where: {
              id: { in: lots.map((l) => l.id) },
              cooperativeId,
              stockItemId: data.stockItemId,
              unit: data.unit,
              status: "AVAILABLE",
              availableQuantity: { gt: 0 },
            },
            orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
          });
          const preview = plan(data, locked);
          if (preview.planHash !== data.expectedPlanHash)
            fail("O estoque mudou. Atualize a prévia antes de confirmar.");
          const item = await tx.wasteStockItem.findFirst({
            where: { id: data.stockItemId, cooperativeId },
            select: { name: true },
          });
          if (!item) fail("Material não encontrado.", 404);
          const actor = await tx.user.findUniqueOrThrow({
            where: { id: r.user.sub },
            select: { displayName: true },
          });
          const allocations = [];
          for (const a of preview.allocations) {
            const lot = locked.find((l) => l.id === a.lotId)!;
            let status = lot.status,
              processingStage = lot.processingStage;
            if (new Prisma.Decimal(a.after).isZero()) {
              const mixed = await tx.wasteStockMovement.count({
                where: {
                  lotId: lot.id,
                  kind: {
                    in: ["SALE", "DONATION", "DIRECT_DESTINATION", "DISPOSAL"],
                    not: data.kind,
                  },
                },
              });
              status =
                mixed || ["DONATION", "DIRECT_DESTINATION"].includes(data.kind)
                  ? "DESTINED"
                  : data.kind === "SALE"
                    ? "SOLD"
                    : "DISCARDED";
              processingStage = "DESTINADO";
            }
            const updated = await tx.wasteStockLot.update({
              where: { id: lot.id },
              data: {
                availableQuantity: new Prisma.Decimal(a.after),
                status,
                processingStage,
                version: { increment: 1 },
              },
            });
            const state = (l: WasteStockLot) => ({
              availableQuantity: Number(l.availableQuantity),
              status: l.status,
              processingStage: l.processingStage,
              version: l.version,
            });
            const movement = await tx.wasteStockMovement.create({
              data: {
                cooperativeId,
                lotId: lot.id,
                operationId: `bulk:${data.operationId}:${lot.id}`,
                operationHash,
                kind: data.kind,
                quantity: new Prisma.Decimal(a.quantity),
                unit: data.unit,
                destinationName: data.destinationName,
                destinationDocument: data.destinationDocument || null,
                destinationAddress: data.destinationAddress || null,
                transportDriverName: data.transportDriverName || null,
                transportVehiclePlate: data.transportVehiclePlate || null,
                transportDocument: data.transportDocument || null,
                environmentalDocument: data.environmentalDocument || null,
                notes: data.notes || null,
                movementDate: new Date(data.movementDate),
                actorUserId: r.user.sub,
                actorName: actor.displayName,
                before: state(lot),
                after: state(updated),
              },
            });
            const composition=await tx.mixedBagOutput.findMany({where:{lotId:lot.id,event:{reversedAt:null}},select:{quantityKg:true,bag:{select:{id:true,code:true,originLabel:true,originSnapshot:true}}},orderBy:[{createdAt:"asc"},{id:"asc"}]});
            allocations.push({ ...a, movementId: movement.id,bagComposition:composition.map(o=>({bagId:o.bag.id,bagCode:o.bag.code,origin:o.bag.originLabel,origins:o.bag.originSnapshot,inputQuantityKg:o.quantityKg.toFixed(3)})) });
          }
          const cooperative = await tx.cooperative.findUniqueOrThrow({
            where: { id: cooperativeId },
            select: { name: true },
          });
          const links = await tx.serviceOrderCollection.findMany({
            where: {
              collectionId: {
                in: preview.allocations
                  .map((a) => a.originCollectionId)
                  .filter((id): id is string => !!id),
              },
              serviceOrder: { cooperativeId },
            },
            select: { serviceOrderId: true },
            distinct: ["serviceOrderId"],
          });
          const created = await tx.internalDocument.create({
            data: {
              cooperativeId,
              kind: "STOCK_DISPATCH",
              eventKey: `STOCK-DISPATCH:${data.operationId}`,
              number: `SAI-${new Date().getUTCFullYear()}-${data.operationId}`,
              snapshot: {
                internalOnly: true,
                operationHash,
                actorUserId: r.user.sub,
                actor: actor.displayName,
                cooperative,
                dispatch: {
                  ...data,
                  materialName: item.name,
                  quantity: preview.quantity,
                  allocations,
                  recordedAt: new Date().toISOString(),
                },
              },
              orders: {
                create: links.map((l) => ({
                  serviceOrderId: l.serviceOrderId,
                })),
              },
            },
            include: docInclude,
          });
          return { document: created, replayed: false };
        },
        { timeout: 20000, maxWait: 10000 },
      );
      return p.code(result.replayed ? 200 : 201).send(result);
    }),
  );
}
