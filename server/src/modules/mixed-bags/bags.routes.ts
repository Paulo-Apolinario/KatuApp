import {
  dailyView,
  dailyAction,
  reverseWeighing,
  stalledBags,
} from "./bags.controls";
import { bagReport } from "./bags.report";
import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import {
  bagContext,
  bagState,
  receive,
  mutate,
  fail,
  type BagContext,
} from "./bags.service";
import {
  receiveBag,
  sorting,
  mutation,
  adjust,
  cancel,
  query,
} from "./bags.schemas";
export async function mixedBagRoutes(app: FastifyInstance) {
  const handle =
    (fn: (ctx: BagContext, r: any, p: any) => Promise<unknown>) =>
    async (r: any, p: any) => {
      p.header("Cache-Control", "private, no-store");
      try {
        return await fn(await bagContext(r.user.sub), r, p);
      } catch (e: any) {
        const conflict = ["P2002", "P2034"].includes(e.code);
        if (!e.statusCode && !(e instanceof z.ZodError) && !conflict)
          r.log.error(
            { code: e.code },
            "Falha no recebimento ou triagem de bag",
          );
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
                : conflict
                  ? "Registro alterado ou protocolo já utilizado. Atualize para conferir antes de repetir."
                  : e.statusCode
                    ? e.message
                    : "Não foi possível concluir a operação. Atualize e confira o resultado antes de repetir.",
          });
      }
    };
  const auth = { preHandler: [app.authenticate] };
  app.get(
    "/mixed-bags/report",
    auth,
    handle(async (ctx, r) => bagReport(ctx, r.query)),
  );
  app.get(
    "/mixed-bags/alerts",
    auth,
    handle(async (ctx, r) => stalledBags(ctx, r.query)),
  );
  app.get(
    "/mixed-bags/day",
    auth,
    handle(async (ctx, r) => dailyView(ctx, r.query)),
  );
  for (const [path, kind] of [
    ["close", "CLOSE"],
    ["reopen", "REOPEN"],
  ] as const)
    app.post(
      `/mixed-bags/day/:day/${path}`,
      auth,
      handle(async (ctx, r, p) => {
        const result = await dailyAction(ctx, r.params.day, kind, r.body);
        return p.code(result.replayed ? 200 : 201).send(result);
      }),
    );
  app.post(
    "/mixed-bags/:id/reverse",
    auth,
    handle(async (ctx, r, p) => {
      const result = await reverseWeighing(ctx, String(r.params.id), r.body);
      return p.code(result.replayed ? 200 : 201).send(result);
    }),
  );
  app.get(
    "/mixed-bags/context",
    auth,
    handle(async (ctx) => {
      const [people, generators, collections] = await Promise.all([
        prisma.collector.findMany({
          where: {
            cooperativeId: ctx.cooperativeId,
            status: { not: "INACTIVE" },
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 1000,
        }),
        prisma.generator.findMany({
          where: { cooperativeId: ctx.cooperativeId },
          select: { id: true, name: true, companyName: true },
          orderBy: { name: "asc" },
          take: 1000,
        }),
        prisma.collection.findMany({
          where: {
            cooperativeId: ctx.cooperativeId,
            OR: [
              {
                intakeKind: "MIXED_BAG",
                status: { in: ["RECEIVED", "SORTING"] },
              },
              {
                status: "COLLECTED",
                receivedAt: null,
                totalWeightKg: 0,
                collectionMaterials: { none: {} },
                collectionWasteEntries: { none: {} },
              },
            ],
          },
          select: {
            id: true,
            intakeKind: true,
            generator: { select: { name: true } },
            route: { select: { name: true } },
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);
      return {
        manager: ctx.manager,
        collectorId: ctx.collectorId,
        actorName: ctx.name,
        people,
        generators,
        collections,
      };
    }),
  );
  app.get(
    "/mixed-bags/catalog",
    auth,
    handle(async (ctx, r) => {
      const q = z
        .object({ search: z.string().trim().max(100).default("") })
        .strict()
        .parse(r.query);
      const where = {
        cooperativeId: ctx.cooperativeId,
        unit: "KG" as const,
        isActive: true,
        status: "ACTIVE" as const,
        ...(q.search
          ? { name: { contains: q.search, mode: "insensitive" as const } }
          : {}),
      };
      const [items, total] = await prisma.$transaction([
        prisma.wasteStockItem.findMany({
          where,
          select: { id: true, name: true, category: true, unit: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: 100,
        }),
        prisma.wasteStockItem.count({ where }),
      ]);
      return { items, total, limited: total > items.length };
    }),
  );
  app.get(
    "/mixed-bags/lots",
    auth,
    handle(async (ctx, r) => {
      const q = z
        .object({ itemId: z.string().min(1).max(100) })
        .strict()
        .parse(r.query);
      return {
        lots: await prisma.wasteStockLot.findMany({
          where: {
            cooperativeId: ctx.cooperativeId,
            stockItemId: q.itemId,
            unit: "KG",
            status: "AVAILABLE",
            processingStage: { in: ["TRIADO", "ARMAZENADO"] },
          },
          select: {
            id: true,
            code: true,
            lotCode: true,
            availableQuantity: true,
            version: true,
            processingStage: true,
          },
          orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
          take: 200,
        }),
      };
    }),
  );
  app.get(
    "/mixed-bags/lots/:id/lineage",
    auth,
    handle(async (ctx, r) => {
      const lot = await prisma.wasteStockLot.findFirst({
        where: { id: String(r.params.id), cooperativeId: ctx.cooperativeId },
        select: {
          id: true,
          quantity: true,
          quantityKg: true,
          availableQuantity: true,
          unit: true,
        },
      });
      if (!lot) fail("Lote não encontrado.", 404);
      const outputs = await prisma.mixedBagOutput.findMany({
        where: { lotId: lot.id, event: { reversedAt: null } },
        include: {
          bag: {
            select: {
              id: true,
              code: true,
              originLabel: true,
              originSnapshot: true,
              receivedAt: true,
            },
          },
          event: { select: { actorName: true, participantSnapshot: true } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const identified = outputs.reduce(
        (s, o) => s.add(o.quantityKg),
        new Prisma.Decimal(0),
      );
      return {
        outputs,
        otherInputQuantityKg:
          lot.unit === "KG"
            ? Prisma.Decimal.max(
                new Prisma.Decimal(lot.quantity ?? lot.quantityKg).sub(
                  identified,
                ),
                0,
              ).toFixed(3)
            : null,
        note: "Composição das entradas do lote. Estas quantidades não representam um rateio das saídas e não devem ser somadas ao saldo atual.",
      };
    }),
  );
  app.get(
    "/mixed-bags",
    auth,
    handle(async (ctx, r) => {
      const q = query.parse(r.query);
      const where: Prisma.MixedBagWhereInput = {
        cooperativeId: ctx.cooperativeId,
        ...(q.status !== "ALL" ? { status: q.status } : {}),
        ...(q.search
          ? {
              OR: [
                { code: { contains: q.search, mode: "insensitive" } },
                { externalTag: { contains: q.search, mode: "insensitive" } },
                { originLabel: { contains: q.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [bags, total, sum] = await prisma.$transaction([
        prisma.mixedBag.findMany({
          where,
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          take: 20,
          skip: (q.page - 1) * 20,
        }),
        prisma.mixedBag.count({ where }),
        prisma.mixedBag.aggregate({
          where: { AND: [where, { status: { not: "CANCELLED" } }] },
          _sum: { netKg: true, sortedKg: true, rejectedKg: true },
          _count: { id: true },
        }),
      ]);
      const net = sum._sum.netKg || new Prisma.Decimal(0),
        sorted = sum._sum.sortedKg || new Prisma.Decimal(0),
        reject = sum._sum.rejectedKg || new Prisma.Decimal(0);
      return {
        items: bags.map((b) => ({ ...b, ...bagState(b) })),
        pagination: {
          page: q.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        },
        summary: {
          bags: sum._count.id,
          receivedKg: net.toFixed(3),
          sortedKg: sorted.toFixed(3),
          rejectedKg: reject.toFixed(3),
          pendingKg: net.sub(sorted).sub(reject).toFixed(3),
        },
      };
    }),
  );
  app.get(
    "/mixed-bags/:id",
    auth,
    handle(async (ctx, r) => {
      const bag = await prisma.mixedBag.findFirst({
        where: { id: String(r.params.id), cooperativeId: ctx.cooperativeId },
        include: {
          events: {
            include: { outputs: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });
      if (!bag) fail("Bag não encontrada.", 404);
      return { bag: { ...bag, ...bagState(bag) } };
    }),
  );
  app.post(
    "/mixed-bags",
    auth,
    handle(async (ctx, r, p) => {
      const result = await receive(ctx, receiveBag.parse(r.body));
      return p.code(result.replayed ? 200 : 201).send(result);
    }),
  );
  for (const [path, kind, schema] of [
    ["sort", "SORT", sorting],
    ["close", "CLOSE", mutation],
    ["adjust", "ADJUST", adjust],
    ["cancel", "CANCEL", cancel],
  ] as const) {
    app.post(
      `/mixed-bags/:id/${path}`,
      auth,
      handle(async (ctx, r, p) => {
        const result = await mutate(
          ctx,
          String(r.params.id),
          kind,
          schema.parse(r.body),
        );
        return p.code(result.replayed ? 200 : 201).send(result);
      }),
    );
  }
}
