import test from "node:test";
import assert from "node:assert/strict";
import {
  monthlyImpact,
  impactSummary,
  civilMonth,
} from "../../src/modules/impact/impact.model";
const date = (s: string) => new Date(s),
  c = (kg: number, d: string, extra: any = {}) => ({
    id: d,
    status: "COLLECTED",
    totalWeightKg: kg,
    collectedAt: date(d),
    createdAt: date(d),
    ...extra,
  });
test("Virada mensal segue Fortaleza e não a data UTC", () => {
  assert.equal(civilMonth("2026-10-01T02:59:59Z"), "2026-09");
  assert.equal(civilMonth("2026-10-01T03:00:00Z"), "2026-10");
});
test("Data de recebimento não desloca coleta de setembro para outubro", () => {
  const a = monthlyImpact(
    [
      c(20, "2026-09-30T23:50:00-03:00", {
        receivedAt: date("2026-10-02T12:00:00Z"),
      }),
    ],
    [],
    [],
    2026,
    {},
  );
  assert.equal(a[8].totalMassKg, 20);
  assert.equal(a[9].totalMassKg, 0);
  assert.equal(a.length, 12);
});
test("Sem fatores é ausência de estimativa, não zero de impacto", () => {
  const s = impactSummary([c(20, "2026-10-01")], {});
  assert.equal(s.totalMassKg, 20);
  assert.equal(s.co2Kg, null);
  assert.equal(s.waterLiters, null);
  assert.equal(s.provisionalMassKg, 20);
});
test("Unidades não são misturadas e fatores ausentes têm cobertura própria", () => {
  const s = impactSummary(
    [
      c(0, "2026-10-01", {
        collectionMaterials: [
          {
            id: "a",
            wasteTypeId: "m",
            nameSnapshot: "Papel",
            quantity: 0.01,
            unit: "TON",
          },
          {
            id: "b",
            wasteTypeId: "b",
            nameSnapshot: "Óleo",
            quantity: 50,
            unit: "LITER",
          },
        ],
      }),
    ],
    {
      factors: [
        { materialId: "m", co2PerKg: null, waterPerKg: 2, energyPerKg: 0 },
      ],
    },
  );
  assert.equal(s.totalMassKg, 10);
  assert.equal(s.co2Kg, null);
  assert.equal(s.waterLiters, 20);
  assert.equal(s.energyKwh, 0);
  assert.equal(s.metricCoverage.energyKwh, 10);
  assert.equal(s.treesEquivalent, null);
});
test("Histórico mantém meses sem coleta e solicitações sem criar peso", () => {
  const a = monthlyImpact(
    [],
    [{ createdAt: date("2026-10-01T12:00:00Z"), status: "REQUESTED" }],
    [{ createdAt: date("2026-10-01T12:00:00Z"), status: "PENDING_REVIEW" }],
    2026,
    {},
  );
  assert.equal(a[9].requests, 1);
  assert.equal(a[9].pendingExtraOrders, 1);
  assert.equal(a[9].totalMassKg, 0);
  assert.equal(a[8].requests, 0);
});
test("Conferência é refletida sem depender de parcelas de equipe", () => {
  const a = c(50, "2026-10-01", { participants: [{ collectorId: "a" }] });
  assert.equal(impactSummary([a], {}).totalMassKg, 50);
  assert.equal(
    impactSummary(
      [{ ...a, totalWeightKg: 40, quantitiesReviewedAt: date("2026-11-01") }],
      {},
    ).confirmedMassKg,
    40,
  );
});

test("Compatibilidade recupera materiais JSON com kg explícitos sem duplicar materiais normalizados", () => {
  const base = {
    id: "legado",
    status: "COMPLETED",
    totalWeightKg: 0,
    materials: [
      { name: "Papelão", quantityKg: 12 },
      { name: "Óleo", unit: "LITER", quantity: 50 },
    ],
  };
  assert.equal(impactSummary([base], {}).totalMassKg, 12);
  assert.equal(
    impactSummary(
      [
        {
          ...base,
          collectionMaterials: [
            { id: "a", nameSnapshot: "Papelão", quantity: 9, unit: "KG" },
          ],
        },
      ],
      {},
    ).totalMassKg,
    9,
  );
});
