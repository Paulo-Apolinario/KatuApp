import { analyticsGet } from "./access";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/lib/prisma";
import { participationQuery } from "../../src/modules/analytics/participation.schemas";
import {
  participationOverview,
  participationDetail,
} from "../../src/modules/analytics/participation.service";
import { participationAttendance } from "../../src/modules/analytics/attendance.service";
import {
  requestDrilldown,
  qualityDrilldown,
  comparisonOverview,
  executiveOverview,
  qualityIssues,
} from "../../src/modules/analytics/insights.service";
import { territoryOverview } from "../../src/modules/analytics/dimensions.service";

export async function testInsights(app: FastifyInstance) {
  const q = participationQuery.parse({
    start: "2026-10-01",
    end: "2026-10-31",
  });
  const attendance = await participationAttendance("attendance-owner", q);
  const outcomes = {
    received: "RECEIVED",
    pending: "PENDING",
    cancelled: "CANCELLED",
    closed_without_receipt: "CLOSED_WITHOUT_RECEIPT",
    needs_check: "CHECK",
  } as const;
  const requests: Record<string, unknown> = {};
  for (const [key, outcome] of Object.entries(outcomes)) {
    const list = await requestDrilldown("attendance-owner", q, outcome);
    assert.equal(list.total, attendance.reconciliation[key]);
    requests[outcome] = list;
  }
  assert.equal(
    (await requestDrilldown("attendance-owner", q, "ALL")).total,
    attendance.reconciliation.total,
  );
  assert.equal((await requestDrilldown("b", q, "ALL")).total, 0);
  assert.equal(
    (await requestDrilldown("attendance-owner", { ...q, search: "%" }, "ALL"))
      .total,
    0,
  );
  const overview = await participationOverview("a", q),
    quality: Record<string, unknown> = {};
  for (const issue of qualityIssues) {
    const list = await qualityDrilldown("a", q, issue);
    assert.equal(list.total, overview.quality[issue], issue);
    quality[issue] = list;
  }
  const comparison = await comparisonOverview("a", q);
  assert.equal(comparison.current.participations, 5);
  assert.equal(comparison.current.requests_created, 4);
  assert.equal(comparison.previous.participations, 1);
  assert.equal(comparison.changes.participations.absolute, 4);
  assert.equal(comparison.changes.participations.percent, 400);
  assert.equal(comparison.changes.repeated.percent, null);
  const partial = await comparisonOverview(
    "a",
    participationQuery.parse({ start: "2026-11-01", end: "2026-11-01" }),
    new Date("2026-11-01T12:00:00Z"),
  );
  assert.equal(partial.meta.partial, true);
  assert.equal(
    partial.meta.previousCutoff.toISOString(),
    "2026-10-31T12:00:00.000Z",
  );
  assert.equal(partial.previous.participations, 0);
  assert.equal(partial.current.participations, 1);
  const territory = await territoryOverview("a", q);
  const oil: any = territory.materialOptions.find(
    (row) => row.unit === "LITER",
  );
  assert(oil);
  const oilMap = await territoryOverview("a", q, new Date(), oil.key);
  assert.equal(oilMap.items.length, 1);
  assert.equal(oilMap.items[0].receipts, 1);
  assert.equal(Number(oilMap.items[0].quantity), 80);
  assert.equal(oilMap.items[0].unit, "LITER");
  const duplicate = await prisma.collectionMaterial.create({
    data: {
      collectionId: "old1",
      nameSnapshot: "Papel",
      unit: "KG",
      quantity: 5,
    },
  });
  const paperMap = await territoryOverview("a", q, new Date(), "N:papel:KG");
  assert.equal(paperMap.items[0].receipts, 1);
  assert.equal(Number(paperMap.items[0].quantity), 15);
  await prisma.collectionMaterial.delete({ where: { id: duplicate.id } });
  const detail = await participationDetail("a", q, "GENERATOR", "old");
  assert.equal(
    detail.materialSummary.find((row) => row.unit === "LITER")?.quantity,
    "80.000",
  );
  const executive = await executiveOverview("a", {
    ...q,
    page: 2,
    pageSize: 5,
    search: "inexistente",
  });
  assert.equal(executive.comparison.current.receipts, 8);
  assert.equal(
    executive.requests.reduce((sum, row) => sum + Number(row.count), 0),
    4,
  );
  assert.equal(
    Number(executive.materials.find((row) => row.unit === "KG")?.quantity),
    30,
  );
  assert.equal(
    Number(executive.materials.find((row) => row.unit === "LITER")?.quantity),
    80,
  );
  assert.equal(executive.usage.accounts, 3);
  assert(!JSON.stringify(executive).includes("Catador equipe"));
  assert.equal(executive.meta.snapshot, "REPEATABLE_READ");
  const token = (id: string, role: string) =>
    app.jwt.sign({ sub: id, role, authVersion: 0 });
  const call = (path: string, auth = token("a", "COOPERATIVE")) =>
    analyticsGet(app, "/analytics/participation/" + path, auth);
  const qs = "start=2026-10-01&end=2026-10-31";
  for (const path of [
    `comparison?${qs}`,
    `executive?${qs}`,
    `requests/ALL?${qs}`,
    `quality/unweighed?${qs}`,
  ]) {
    const response = await call(path);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "private, no-store");
    assert.equal((await call(path, token("pf", "PF"))).statusCode, 403);
  }
  assert.equal((await call(`requests/BAD?${qs}`)).statusCode, 400);
  assert.equal((await call(`quality/BAD?${qs}`)).statusCode, 400);
  assert.equal(
    (await call(`executive?${qs}&cooperativeId=coop-b`)).statusCode,
    400,
  );
  const apiMap = await call(
    `territory?${qs}&materialKey=${encodeURIComponent(oil.key)}`,
  );
  assert.equal(apiMap.statusCode, 200, apiMap.body);
  assert.equal(apiMap.json().data.items[0].unit, "LITER");
  const apiRequests = (await call(`requests/RECEIVED?${qs}`)).json().data;
  assert.equal(apiRequests.total, 3);
  const apiQuality = (await call(`quality/missing_received_date?${qs}`)).json()
    .data;
  console.log(
    "PASS: all request/quality counters reconcile with drilldowns; equal partial windows; zero baseline; material/unit map without duplicate receipts; complete executive snapshot, permissions and read-only scope",
  );
  return {
    comparison,
    executive,
    requests: requests.RECEIVED,
    quality: apiQuality,
    oilMap,
    oilKey: oil.key,
  };
}
