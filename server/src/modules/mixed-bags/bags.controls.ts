import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { bagState, fail, type BagContext } from "./bags.service";
import {
  civilDay,
  dayValue,
  dayRange,
  lockDay,
  assertDayOpen,
} from "./bags.calendar";
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
const dec = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const sum = (values: Prisma.Decimal.Value[]) =>
  values.reduce<Prisma.Decimal>((s, v) => s.add(v), dec(0));
const identity = z
  .object({
    operationId: z.string().uuid(),
    expectedVersion: z.number().int().min(0),
    notes: z.string().trim().min(5).max(1500),
  })
  .strict();
const reversalSchema = identity
  .extend({ eventId: z.string().min(1).max(100) })
  .strict();
async function snapshot(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  day: string,
) {
  const events = await tx.mixedBagEvent.findMany({
    where: {
      cooperativeId,
      kind: "SORT",
      reversedAt: null,
      createdAt: dayRange(day),
    },
    include: { outputs: true },
    orderBy: { id: "asc" },
    take: 10001,
  });
  if (events.length > 10000)
    fail(
      "Há mais de 10 mil pesagens neste dia. O fechamento exige revisão técnica da seleção completa.",
      422,
    );
  const reversals = await tx.mixedBagEvent.findMany({
    where: { cooperativeId, kind: "REVERSAL", createdAt: dayRange(day) },
    select: { id: true, reversalOfId: true },
    orderBy: { id: "asc" },
  });
  const materials = new Map<string, any>(),
    people = new Map<string, any>();
  for (const e of events) {
    const quantity = sum(e.outputs.map((o) => o.quantityKg));
    for (const o of e.outputs) {
      const m = materials.get(o.itemId) || {
        itemId: o.itemId,
        name: o.materialName,
        quantityKg: dec(0),
      };
      m.quantityKg = m.quantityKg.add(o.quantityKg);
      materials.set(o.itemId, m);
    }
    for (const p of new Map(
      (e.participantSnapshot as any[]).map((p) => [p.id, p]),
    ).values()) {
      const v = people.get(p.id) || {
        id: p.id,
        name: p.name,
        operations: 0,
        collectiveKg: dec(0),
      };
      v.operations++;
      v.collectiveKg = v.collectiveKg.add(quantity);
      people.set(p.id, v);
    }
  }
  const data = {
    day,
    timeZone: "America/Fortaleza",
    operations: events.length,
    bags: new Set(events.map((e) => e.bagId)).size,
    sortedKg: sum(
      events.flatMap((e) => e.outputs.map((o) => o.quantityKg)),
    ).toFixed(3),
    rejectedKg: sum(events.map((e) => e.rejectedKg)).toFixed(3),
    materials: [...materials.values()]
      .sort((a, b) => a.itemId.localeCompare(b.itemId))
      .map((m) => ({ ...m, quantityKg: m.quantityKg.toFixed(3) })),
    participants: [...people.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => ({ ...p, collectiveKg: p.collectiveKg.toFixed(3) })),
    eventIds: events.map((e) => e.id),
    reversals,
  };
  return { ...data, fingerprint: hash(data) };
}
export async function dailyView(ctx: BagContext, input: unknown) {
  const { day } = z.object({ day: dayValue }).strict().parse(input);
  if (day > civilDay()) fail("O dia não pode estar no futuro.", 400);
  return prisma.$transaction(
    async (tx) => {
      const row = await tx.triageDay.findUnique({
        where: { cooperativeId_day: { cooperativeId: ctx.cooperativeId, day } },
        include: { actions: { orderBy: { createdAt: "desc" }, take: 100 } },
      });
      return {
        manager: ctx.manager,
        day,
        status: row?.status || "OPEN",
        version: row?.version || 0,
        preview: await snapshot(tx, ctx.cooperativeId, day),
        snapshot: row?.snapshot || null,
        actions: row?.actions || [],
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 15000 },
  );
}
export async function dailyAction(
  ctx: BagContext,
  dayInput: unknown,
  kind: "CLOSE" | "REOPEN",
  input: unknown,
) {
  if (!ctx.manager)
    fail("Somente o gestor pode fechar ou reabrir a produção.", 403);
  const day = dayValue.parse(dayInput);
  if (day > civilDay()) fail("O dia não pode estar no futuro.", 400);
  const data = identity
    .omit({ notes: true })
    .extend({
      notes: z.string().trim().max(1500).default(""),
      expectedFingerprint: z.string().length(64).optional(),
    })
    .strict()
    .parse(input);
  if (kind === "REOPEN" && data.notes.length < 5)
    fail(
      "Informe a justificativa da reabertura, com pelo menos cinco caracteres.",
      400,
    );
  if (kind === "CLOSE" && !data.expectedFingerprint)
    fail("Atualize e confira o resumo antes de fechar.", 400);
  const digest = hash({ day, kind, ...data });
  return prisma.$transaction(
    async (tx) => {
      await lockDay(tx, ctx.cooperativeId, day);
      const old = await tx.triageDayAction.findUnique({
        where: {
          cooperativeId_operationId: {
            cooperativeId: ctx.cooperativeId,
            operationId: data.operationId,
          },
        },
      });
      if (old) {
        if (old.operationHash !== digest || old.actorUserId !== ctx.userId)
          fail("Protocolo já utilizado com outros dados.");
        return { action: old, replayed: true };
      }
      const row = await tx.triageDay.upsert({
        where: { cooperativeId_day: { cooperativeId: ctx.cooperativeId, day } },
        create: { cooperativeId: ctx.cooperativeId, day, snapshot: {} },
        update: {},
      });
      if (row.version !== data.expectedVersion)
        fail("O fechamento mudou. Atualize antes de confirmar.");
      if (
        (kind === "CLOSE" && row.status === "CLOSED") ||
        (kind === "REOPEN" && row.status !== "CLOSED")
      )
        fail("Esta ação não corresponde à situação atual do dia.");
      const current =
        kind === "CLOSE"
          ? await snapshot(tx, ctx.cooperativeId, day)
          : row.snapshot;
      if (
        kind === "CLOSE" &&
        (current as any).fingerprint !== data.expectedFingerprint
      )
        fail(
          "As pesagens mudaram desde a conferência. Atualize o resumo antes de fechar.",
        );
      const updated = await tx.triageDay.update({
        where: { id: row.id },
        data: {
          status: kind === "CLOSE" ? "CLOSED" : "OPEN",
          version: { increment: 1 },
          snapshot: current as any,
        },
      });
      const action = await tx.triageDayAction.create({
        data: {
          dayId: row.id,
          cooperativeId: ctx.cooperativeId,
          operationId: data.operationId,
          operationHash: digest,
          kind,
          actorUserId: ctx.userId,
          actorName: ctx.name,
          notes: data.notes,
          snapshot: json({
            version: updated.version,
            status: updated.status,
            production: current,
          }),
        },
      });
      return { action, replayed: false };
    },
    { timeout: 20000 },
  );
}
export async function reverseWeighing(
  ctx: BagContext,
  bagId: string,
  input: unknown,
) {
  if (!ctx.manager) fail("Somente o gestor pode estornar uma pesagem.", 403);
  const data = reversalSchema.parse(input),
    digest = hash({ bagId, ...data });
  return prisma.$transaction(
    async (tx) => {
      const source = await tx.mixedBagEvent.findFirst({
        where: {
          id: data.eventId,
          bagId,
          cooperativeId: ctx.cooperativeId,
          kind: "SORT",
        },
        include: {
          outputs: {
            include: {
              lot: true,
              destination: { include: { collectionWasteEntry: true } },
            },
          },
        },
      });
      if (!source) fail("Pesagem não encontrada.", 404);
      const replay = await tx.mixedBagEvent.findUnique({
        where: {
          cooperativeId_operationId: {
            cooperativeId: ctx.cooperativeId,
            operationId: data.operationId,
          },
        },
      });
      if (replay) {
        if (
          replay.operationHash !== digest ||
          replay.actorUserId !== ctx.userId
        )
          fail("Protocolo já utilizado com outros dados.");
        return { replayed: true, event: replay };
      }
      const now = new Date();
      for (const day of [
        ...new Set([civilDay(now), civilDay(source.createdAt)]),
      ].sort())
        await assertDayOpen(tx, ctx.cooperativeId, day);
      const previous = await tx.mixedBagEvent.findUnique({
        where: {
          cooperativeId_operationId: {
            cooperativeId: ctx.cooperativeId,
            operationId: data.operationId,
          },
        },
      });
      if (previous) {
        if (
          previous.operationHash !== digest ||
          previous.actorUserId !== ctx.userId
        )
          fail("Protocolo já utilizado com outros dados.");
        return { replayed: true, event: previous };
      }
      const head = await tx.mixedBag.findUniqueOrThrow({
        where: { id: bagId },
      });
      const origins = [
        ...new Set([
          head.collectionId,
          ...source.outputs.flatMap((o) =>
            o.lot.originCollectionId ? [o.lot.originCollectionId] : [],
          ),
        ]),
      ].sort();
      for (const id of origins)
        await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${id} AND "cooperativeId"=${ctx.cooperativeId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "MixedBag" WHERE id=${bagId} AND "cooperativeId"=${ctx.cooperativeId} FOR UPDATE`;
      const bag = await tx.mixedBag.findUniqueOrThrow({ where: { id: bagId } }),
        original = await tx.mixedBagEvent.findUniqueOrThrow({
          where: { id: source.id },
        });
      if (bag.version !== data.expectedVersion)
        fail("A bag mudou. Atualize antes de estornar.");
      if (original.reversedAt) fail("Esta pesagem já foi estornada.");
      if (bag.status === "CANCELLED") fail("Bag cancelada.");
      for (const id of [...new Set(source.outputs.map((o) => o.lotId))].sort())
        await tx.$queryRaw`SELECT id FROM "WasteStockLot" WHERE id=${id} AND "cooperativeId"=${ctx.cooperativeId} FOR UPDATE`;
      for (const o of source.outputs) {
        const lot = await tx.wasteStockLot.findUniqueOrThrow({
          where: { id: o.lotId },
        });
        const incoming = await tx.wasteStockMovement.findFirst({
          where: {
            lotId: lot.id,
            operationId: { startsWith: `BAG:${source.operationId}:` },
            kind: "SORTING_IN",
          },
        });
        if (!incoming)
          fail("Entrada do lote sem histórico suficiente para estorno seguro.");
        const used = await tx.wasteStockMovement.findFirst({
          where: {
            lotId: lot.id,
            kind: { notIn: ["SORTING_IN", "SORTING_REVERSAL"] },
          },
        });
        if (
          used ||
          lot.status !== "AVAILABLE" ||
          !["TRIADO", "ARMAZENADO"].includes(lot.processingStage) ||
          lot.availableQuantity.lt(o.quantityKg) ||
          dec(lot.quantity ?? 0).lt(o.quantityKg) ||
          dec(lot.quantityKg).lt(o.quantityKg)
        )
          fail(
            `O lote ${o.lotCode} já foi movimentado, reservado ou processado, ou não tem saldo suficiente. O estorno foi bloqueado; confira o histórico do lote.`,
          );
        if (
          lot.originCollectionMaterialId === o.materialId &&
          (await tx.mixedBagOutput.count({
            where: {
              lotId: lot.id,
              eventId: { not: source.id },
              event: { reversedAt: null },
            },
          }))
        )
          fail(
            `O lote ${o.lotCode} recebeu complementações. Estorne primeiro essas pesagens para preservar a origem.`,
          );
        const before = {
          quantity: String(lot.quantity),
          availableQuantity: String(lot.availableQuantity),
          status: lot.status,
          processingStage: lot.processingStage,
          version: lot.version,
        };
        const remaining = lot.availableQuantity.sub(o.quantityKg);
        const updated = await tx.wasteStockLot.update({
          where: { id: lot.id },
          data: {
            quantity: dec(lot.quantity ?? 0).sub(o.quantityKg),
            availableQuantity: remaining,
            quantityKg: Number(dec(lot.quantityKg).sub(o.quantityKg)),
            status: remaining.isZero() ? "CANCELLED" : "AVAILABLE",
            version: { increment: 1 },
          },
        });
        await tx.wasteStockMovement.create({
          data: {
            cooperativeId: ctx.cooperativeId,
            lotId: lot.id,
            operationId: `BAG-REV:${data.operationId}:${o.id}`,
            operationHash: digest,
            kind: "SORTING_REVERSAL",
            quantity: o.quantityKg,
            unit: "KG",
            actorUserId: ctx.userId,
            actorName: ctx.name,
            notes: data.notes,
            before,
            after: json({
              quantity: updated.quantity,
              availableQuantity: updated.availableQuantity,
              status: updated.status,
              processingStage: updated.processingStage,
              version: updated.version,
            }),
          },
        });
        await tx.collectionMaterial.update({
          where: { id: o.materialId },
          data: { reportedQuantity: o.quantityKg, quantity: 0 },
        });
        await tx.collectionWasteEntry.update({
          where: { id: o.destination.collectionWasteEntryId },
          data: {
            collectedQuantity: 0,
            destinedQuantity: 0,
            remainingQuantity: 0,
            status: "CANCELLED",
            notes: `Estorno da pesagem ${source.id}: ${data.notes}`,
          },
        });
        await tx.collectionWasteDestination.update({
          where: { id: o.destinationId },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            cancelledReason: data.notes,
            cancelledByUserId: ctx.userId,
            version: { increment: 1 },
          },
        });
        await tx.collectionWasteDestinationEvent.create({
          data: {
            destinationId: o.destinationId,
            actorUserId: ctx.userId,
            actorName: ctx.name,
            operation: "BAG_SORT_REVERSAL",
            snapshot: json({
              eventId: source.id,
              originalQuantity: o.quantityKg,
              reason: data.notes,
            }),
          },
        });
      }
      const amount = sum(source.outputs.map((o) => o.quantityKg));
      const next = await tx.mixedBag.update({
        where: { id: bagId },
        data: {
          sortedKg: { decrement: amount },
          rejectedKg: { decrement: source.rejectedKg },
          status: "SORTING",
          closedAt: null,
          version: { increment: 1 },
        },
      });
      await tx.mixedBagEvent.update({
        where: { id: source.id },
        data: { reversedAt: now },
      });
      const event = await tx.mixedBagEvent.create({
        data: {
          bagId,
          cooperativeId: ctx.cooperativeId,
          operationId: data.operationId,
          operationHash: digest,
          kind: "REVERSAL",
          reversalOfId: source.id,
          actorUserId: ctx.userId,
          actorName: ctx.name,
          participantSnapshot: [],
          notes: data.notes,
          createdAt: now,
          before: json(bagState(bag)),
          after: json({
            ...bagState(next),
            reversedSortedKg: amount.toFixed(3),
            reversedRejectedKg: source.rejectedKg.toFixed(3),
          }),
        },
      });
      const collection = await tx.collection.findUniqueOrThrow({
        where: { id: head.collectionId },
      });
      const amounts = await tx.mixedBag.aggregate({
        where: {
          collectionId: head.collectionId,
          status: { not: "CANCELLED" },
        },
        _sum: { sortedKg: true },
      });
      await tx.collection.update({
        where: { id: head.collectionId },
        data: {
          totalWeightKg: Number(amounts._sum.sortedKg || 0),
          status: "SORTING",
          completedAt: null,
          completedByUserId: null,
          quantityReviewVersion: { increment: 1 },
          quantitiesReviewedAt: now,
        },
      });
      if (collection.generatorId && amount.gt(0))
        await tx.generator.update({
          where: { id: collection.generatorId },
          data: { totalKg: { decrement: Number(amount) } },
        });
      return { replayed: false, event, bag: { ...next, ...bagState(next) } };
    },
    { timeout: 30000 },
  );
}
export async function stalledBags(ctx: BagContext, input: unknown) {
  const q = z
    .object({
      hours: z.coerce.number().int().min(1).max(720).default(48),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    })
    .strict()
    .parse(input);
  const now = new Date(),
    cutoff = new Date(now.getTime() - q.hours * 3600000);
  const base = Prisma.sql`SELECT b.id,b.code,b."originLabel",b."netKg"-b."sortedKg"-b."rejectedKg" AS pending,COALESCE((SELECT MAX(e."createdAt") FROM "MixedBagEvent" e WHERE e."bagId"=b.id),b."receivedAt") AS activity FROM "MixedBag" b WHERE b."cooperativeId"=${ctx.cooperativeId} AND b.status IN ('WAITING','SORTING') AND b."netKg">b."sortedKg"+b."rejectedKg"`;
  return prisma.$transaction(
    async (tx) => {
      const totals = await tx.$queryRaw<any[]>(
        Prisma.sql`WITH pending AS (${base}) SELECT COUNT(*)::int AS count,COALESCE(SUM(pending),0) AS weight FROM pending WHERE activity<=${cutoff}`,
      );
      const items = await tx.$queryRaw<any[]>(
        Prisma.sql`WITH pending AS (${base}) SELECT * FROM pending WHERE activity<=${cutoff} ORDER BY activity,id LIMIT 20 OFFSET ${(q.page - 1) * 20}`,
      );
      return {
        hours: q.hours,
        generatedAt: now.toISOString(),
        total: totals[0].count,
        pendingKg: String(totals[0].weight),
        page: q.page,
        totalPages: Math.max(1, Math.ceil(totals[0].count / 20)),
        items: items.map((b) => ({
          id: b.id,
          code: b.code,
          originLabel: b.originLabel,
          pendingKg: String(b.pending),
          lastActivity: b.activity,
          idleHours: Math.floor(
            (now.getTime() - new Date(b.activity).getTime()) / 3600000,
          ),
        })),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
