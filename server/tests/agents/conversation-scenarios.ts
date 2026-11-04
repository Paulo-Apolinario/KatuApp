import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
import {
  COMMANDS,
  normalizeCommand,
  resolveCommandText,
} from "../../src/modules/agents/agents.commands";
import {
  COMMAND_PHRASES,
  CLARIFICATION_PHRASES,
  UNSUPPORTED_PHRASES,
} from "../../src/modules/agents/agents.vocabulary";
import { analyzeCollections } from "../../src/modules/agents/agents.collections";
import { additionalAnalysis } from "../../src/modules/agents/agents.queries";
type Test = (name: string, fn: () => Promise<void> | void) => Promise<void>;
export async function runConversationScenarios(test: Test) {
  for (const command of COMMANDS)
    await test(`vocabulário: ${command.key}, frases revisadas e variações de você`, () => {
      for (const phrase of COMMAND_PHRASES[command.key]) {
        const plain = phrase.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const text of new Set([
          phrase,
          phrase.toUpperCase(),
          plain,
          plain.toUpperCase(),
          plain.replace(/voce/gi, "vc"),
          plain.replace(/voce/gi, "vce"),
          plain.replace(/voce/gi, "VoCe"),
          `  ${phrase.replace(/ /g, "   ")}  `,
        ]))
          assert.equal(resolveCommandText(text).command, command.key, text);
      }
    });
  await test("vocabulário: nenhum exemplo ou alias normalizado aponta para duas consultas", () => {
    const keys = new Map<string, string>();
    for (const command of COMMANDS)
      for (const phrase of [
        command.example,
        ...command.aliases,
        ...COMMAND_PHRASES[command.key],
      ]) {
        const key = normalizeCommand(phrase);
        if (keys.has(key)) assert.equal(keys.get(key), command.key, phrase);
        keys.set(key, command.key);
      }
  });
  await test("vocabulário: arquivo contém exemplos ambíguos e negativos que não executam análise", () => {
    for (const text of CLARIFICATION_PHRASES)
      assert.equal(resolveCommandText(text).method, "CLARIFICATION", text);
    for (const text of UNSUPPORTED_PHRASES)
      assert.equal(resolveCommandText(text).command, null, text);
    for (const text of [
      "VC PODERIA MOSTRAR COLETAS PENDENTES",
      "você poderia mostrar coletas pendentes",
      "Voce poderia mostrar coletas pendentes",
      "vc poderia mostrar coeltas pendentes",
    ])
      assert.equal(
        resolveCommandText(text).command,
        "PENDING_COLLECTIONS",
        text,
      );
    assert.equal(
      resolveCommandText("pfv mostrar coletas de hj").command,
      "TODAY_COLLECTIONS",
    );
  });
  const now = new Date("2026-11-04T15:00:00Z"),
    old = new Date(+now - 48 * 3600000),
    future = new Date(+now + 86400000);
  for (const key of ["a", "b"]) {
    await prisma.user.create({
      data: {
        id: `dialogue-user-${key}`,
        email: `dialogue-${key}@qa.invalid`,
        role: "COOPERATIVE",
        displayName: "Diálogo QA",
        passwordHash: "unused",
      },
    });
    await prisma.cooperative.create({
      data: {
        id: `dialogue-coop-${key}`,
        userId: `dialogue-user-${key}`,
        name: "Diálogo QA",
      },
    });
    await prisma.cooperativeSettings.create({
      data: {
        cooperativeId: `dialogue-coop-${key}`,
        payload: { preferences: { collectionOverdueHours: 24 } },
      },
    });
  }
  const cooperativeId = "dialogue-coop-a";
  for (const [id, status, scheduledDate, createdAt] of [
    ["dialogue-old", "REQUESTED", old, old],
    ["dialogue-recent", "REQUESTED", null, now],
    ["dialogue-unassigned", "SCHEDULED", future, now],
    ["dialogue-healthy", "IN_PROGRESS", now, now],
  ] as const)
    await prisma.schedule.create({
      data: {
        id,
        cooperativeId,
        requestedByUserId: "dialogue-user-a",
        status,
        scheduledDate,
        createdAt,
      },
    });
  await prisma.schedule.create({
    data: {
      id: "dialogue-foreign-old",
      cooperativeId: "dialogue-coop-b",
      requestedByUserId: "dialogue-user-b",
      scheduledDate: old,
      createdAt: old,
    },
  });
  const route = await prisma.route.create({
    data: {
      cooperativeId,
      name: "Rota saudável QA",
      scheduledDate: future,
      status: "IN_PROGRESS",
    },
  });
  await prisma.collection.create({
    data: {
      id: "dialogue-collection",
      cooperativeId,
      scheduleId: "dialogue-healthy",
      routeId: route.id,
      status: "IN_PROGRESS",
    },
  });
  await test("coletas: quatro comandos têm escopos, resumos e indicadores distintos em cenário misto", async () => {
    const pending = await analyzeCollections(
      cooperativeId,
      "PENDING_COLLECTIONS",
      now,
    );
    const overdue = await analyzeCollections(
      cooperativeId,
      "OVERDUE_REQUESTS",
      now,
    );
    const priorities = await analyzeCollections(
      cooperativeId,
      "COLLECTION_PRIORITIES",
      now,
    );
    const today = (await additionalAnalysis(
      cooperativeId,
      "TODAY_COLLECTIONS",
      now,
    ))!;
    assert.equal(
      new Set([
        pending.summary,
        overdue.summary,
        priorities.summary,
        today.summary,
      ]).size,
      4,
    );
    assert.equal(pending.counts.activeRequests, 4);
    assert.equal(pending.counts.fieldPendingCollections, 1);
    assert.equal(overdue.counts.overdueRequests, 1);
    assert(!("fieldPendingCollections" in overdue.counts));
    assert.deepEqual(
      overdue.items.map((x) => x.id),
      ["dialogue-old"],
    );
    assert.equal(priorities.counts.priorityRecordsInSample, 2);
    assert.deepEqual(
      priorities.items.map((x) => x.id),
      ["dialogue-old", "dialogue-unassigned"],
    );
    assert.equal(priorities.items[0].priority, "HIGH");
    assert.equal(priorities.items[1].priority, "MEDIUM");
    assert.equal(today.counts.todayCollections, 1);
    for (const result of [pending, overdue, priorities, today])
      assert(!JSON.stringify(result).includes("dialogue-foreign-old"));
  });
  await test("coletas: pedido recente sem outros sinais e coleta saudável não são prioridades artificiais", async () => {
    const result = await analyzeCollections(
      cooperativeId,
      "COLLECTION_PRIORITIES",
      now,
    );
    assert(
      !result.items.some((x) =>
        ["dialogue-recent", "dialogue-healthy", "dialogue-collection"].includes(
          x.id,
        ),
      ),
    );
    assert(result.warnings.some((w) => w.includes("Coincidência")));
  });
  await test("atrasos: filtro de datas é aplicado antes do limite e contagem total coincide com o escopo", async () => {
    await prisma.schedule.createMany({
      data: Array.from({ length: 101 }, (_, i) => ({
        id: `dialogue-future-${i}`,
        cooperativeId,
        requestedByUserId: "dialogue-user-a",
        scheduledDate: future,
        createdAt: new Date(+now - 10 * 86400000),
      })),
    });
    const result = await analyzeCollections(
      cooperativeId,
      "OVERDUE_REQUESTS",
      now,
    );
    assert.equal(result.counts.overdueRequests, 1);
    assert.deepEqual(
      result.items.map((x) => x.id),
      ["dialogue-old"],
    );
    assert.equal(result.truncated, false);
  });
}
