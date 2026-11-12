import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { bagState, fail, type BagContext } from "./bags.service";
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida.");
const schema = z
  .object({
    start: day.optional(),
    end: day.optional(),
    participantId: z.string().max(100).default(""),
    bucket: z
      .enum(["ALL", "PENDING", "SORTED", "REJECTED", "COMPLETED"])
      .default("ALL"),
    itemId: z.string().max(100).default(""),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    eventPage: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
const decimal = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const total = (values: Prisma.Decimal.Value[]) =>
  values.reduce<Prisma.Decimal>((s, v) => s.add(v), decimal(0));
const civil = (d: Date) =>
  new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);
const percent = (part: Prisma.Decimal, whole: Prisma.Decimal) =>
  whole.gt(0) ? part.div(whole).mul(100).toDecimalPlaces(2).toNumber() : null;
export async function bagReport(ctx: BagContext, input: unknown) {
  const q = schema.parse(input),
    today = civil(new Date());
  const end = q.end || today,
    start =
      q.start ||
      new Date(new Date(end + "T12:00:00Z").getTime() - 29 * 86400000)
        .toISOString()
        .slice(0, 10);
  const from = new Date(start + "T00:00:00-03:00"),
    until = new Date(new Date(end + "T00:00:00-03:00").getTime() + 86400000);
  if (end > today) fail("A data final não pode estar no futuro.", 400);
  if (from >= until || until.getTime() - from.getTime() > 366 * 86400000)
    fail("Selecione um período válido de até 366 dias.", 400);
  if (
    q.participantId &&
    !(await prisma.collector.findFirst({
      where: { id: q.participantId, cooperativeId: ctx.cooperativeId },
      select: { id: true },
    }))
  )
    fail("Participante não encontrado nesta cooperativa.", 404);
  const eventScope: Prisma.MixedBagEventWhereInput = {
    cooperativeId: ctx.cooperativeId,
    kind: "SORT",
    reversedAt: null,
    createdAt: { gte: from, lt: until },
    ...(q.participantId
      ? { participantSnapshot: { array_contains: [{ id: q.participantId }] } }
      : {}),
  };
  const bagScope: Prisma.MixedBagWhereInput = {
    cooperativeId: ctx.cooperativeId,
    status: { not: "CANCELLED" },
    receivedAt: { gte: from, lt: until },
    ...(q.participantId ? { events: { some: eventScope } } : {}),
  };
  const result = await prisma.$transaction(
    async (tx) => {
      const bags = await tx.mixedBag.findMany({
        where: bagScope,
        orderBy: [{ receivedAt: "desc" }, { id: "asc" }],
        take: 5001,
      });
      const events = await tx.mixedBagEvent.findMany({
        where: {
          ...eventScope,
          bag: {
            cooperativeId: ctx.cooperativeId,
            status: { not: "CANCELLED" },
          },
        },
        include: {
          outputs: true,
          bag: { select: { id: true, code: true, originLabel: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 10001,
      });
      const people = await tx.collector.findMany({
        where: { cooperativeId: ctx.cooperativeId },
        select: { id: true, name: true, status: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 1000,
      });
      return { bags, events, people };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 15000,
    },
  );
  if (result.bags.length > 5000 || result.events.length > 10000)
    fail(
      "Há muitos registros nesta seleção. Reduza o período ou filtre um participante para consultar os totais completos.",
      422,
    );
  const net = total(result.bags.map((b) => b.netKg)),
    sorted = total(result.bags.map((b) => b.sortedKg)),
    reject = total(result.bags.map((b) => b.rejectedKg));
  const prodSorted = total(
      result.events.flatMap((e) => e.outputs.map((o) => o.quantityKg)),
    ),
    prodReject = total(result.events.map((e) => e.rejectedKg));
  const material = new Map<
    string,
    {
      itemId: string;
      name: string;
      kg: Prisma.Decimal;
      events: Set<string>;
      lots: Set<string>;
    }
  >();
  const participants = new Map<
    string,
    {
      id: string;
      name: string;
      operations: number;
      kg: Prisma.Decimal;
      bags: Set<string>;
    }
  >();
  const days = new Map<
    string,
    {
      date: string;
      sortedKg: Prisma.Decimal;
      rejectedKg: Prisma.Decimal;
      operations: number;
    }
  >();
  for (let d = from.getTime(); d < until.getTime(); d += 86400000) {
    const date = civil(new Date(d));
    days.set(date, {
      date,
      sortedKg: decimal(0),
      rejectedKg: decimal(0),
      operations: 0,
    });
  }
  for (const e of result.events) {
    const kg = total(e.outputs.map((o) => o.quantityKg)),
      d = days.get(civil(e.createdAt))!;
    d.sortedKg = d.sortedKg.add(kg);
    d.rejectedKg = d.rejectedKg.add(e.rejectedKg);
    d.operations++;
    for (const o of e.outputs) {
      const m = material.get(o.itemId) || {
        itemId: o.itemId,
        name: o.materialName,
        kg: decimal(0),
        events: new Set<string>(),
        lots: new Set<string>(),
      };
      m.kg = m.kg.add(o.quantityKg);
      m.events.add(e.id);
      m.lots.add(o.lotId);
      material.set(o.itemId, m);
    }
    const seen = new Set<string>();
    for (const p of (Array.isArray(e.participantSnapshot)
      ? e.participantSnapshot
      : []) as any[]) {
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      const row = participants.get(p.id) || {
        id: p.id,
        name: p.name || "Participante",
        operations: 0,
        kg: decimal(0),
        bags: new Set<string>(),
      };
      row.operations++;
      row.kg = row.kg.add(kg);
      row.bags.add(e.bagId);
      participants.set(p.id, row);
    }
  }
  const filteredBags = result.bags.filter((b) =>
    q.bucket === "PENDING"
      ? b.netKg.sub(b.sortedKg).sub(b.rejectedKg).gt(0)
      : q.bucket === "SORTED"
        ? b.sortedKg.gt(0)
        : q.bucket === "REJECTED"
          ? b.rejectedKg.gt(0)
          : q.bucket === "COMPLETED"
            ? b.status === "COMPLETED"
            : true,
  );
  const filteredEvents = result.events.filter(
    (e) => !q.itemId || e.outputs.some((o) => o.itemId === q.itemId),
  );
  const paginate = (rows: any[], page: number) => ({
    items: rows.slice((page - 1) * 20, page * 20),
    pagination: {
      page,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / 20)),
    },
  });
  return {
    meta: {
      start,
      end,
      timeZone: "America/Fortaleza",
      generatedAt: new Date().toISOString(),
      participantId: q.participantId,
      partial: end >= today,
    },
    people: result.people,
    cohort: {
      bags: result.bags.length,
      completed: result.bags.filter((b) => b.status === "COMPLETED").length,
      receivedKg: net.toFixed(3),
      sortedKg: sorted.toFixed(3),
      rejectedKg: reject.toFixed(3),
      pendingKg: net.sub(sorted).sub(reject).toFixed(3),
      recoveredPercent: percent(sorted, net),
      rejectedPercent: percent(reject, net),
    },
    production: {
      operations: result.events.length,
      bags: new Set(result.events.map((e) => e.bagId)).size,
      sortedKg: prodSorted.toFixed(3),
      rejectedKg: prodReject.toFixed(3),
    },
    materials: [...material.values()]
      .sort((a, b) => b.kg.cmp(a.kg) || a.name.localeCompare(b.name))
      .map((m) => ({
        itemId: m.itemId,
        name: m.name,
        quantityKg: m.kg.toFixed(3),
        operations: m.events.size,
        lots: m.lots.size,
      })),
    participants: [...participants.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        operations: p.operations,
        collectiveKg: p.kg.toFixed(3),
        bags: p.bags.size,
      })),
    series: [...days.values()].map((d) => ({
      ...d,
      sortedKg: d.sortedKg.toFixed(3),
      rejectedKg: d.rejectedKg.toFixed(3),
    })),
    bags: paginate(
      filteredBags.map((b) => ({
        ...b,
        ...bagState(b),
        recoveredPercent: percent(b.sortedKg, b.netKg),
        rejectedPercent: percent(b.rejectedKg, b.netKg),
      })),
      q.page,
    ),
    events: paginate(
      filteredEvents.map((e) => ({
        id: e.id,
        bag: e.bag,
        createdAt: e.createdAt,
        actorName: e.actorName,
        participantSnapshot: e.participantSnapshot,
        rejectedKg: e.rejectedKg.toFixed(3),
        outputs: e.outputs.map((o) => ({
          id: o.id,
          itemId: o.itemId,
          materialName: o.materialName,
          quantityKg: o.quantityKg.toFixed(3),
          lotId: o.lotId,
          lotCode: o.lotCode,
        })),
      })),
      q.eventPage,
    ),
  };
}
