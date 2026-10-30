import test from "node:test";
import assert from "node:assert/strict";
import {
  allocationSnapshot,
  creditedKg,
} from "../../src/modules/collector-teams/team.model";
const members = [
  { collectorId: "a", nameSnapshot: "A" },
  { collectorId: "b", nameSnapshot: "B" },
  { collectorId: "c", nameSnapshot: "C" },
];
const materials = [
  { id: "kg", nameSnapshot: "Papel", unit: "KG", quantity: 40 },
  { id: "ton", nameSnapshot: "Metal", unit: "TON", quantity: 0.003 },
  { id: "litro", nameSnapshot: "Óleo", unit: "LITER", quantity: 15 },
];
const items = materials.flatMap((m) =>
  members.map((p, i) => ({
    materialId: m.id,
    collectorId: p.collectorId,
    quantity:
      m.id === "kg" ? [13.334, 13.333, 13.333][i] : m.id === "ton" ? 0.001 : 5,
  })),
);
test("Rateio conserva cada unidade, converte apenas massa e não multiplica litros", () => {
  const s = allocationSnapshot(materials, members, items);
  const c = {
    status: "SORTING",
    allocationVersion: 1,
    allocationQuantityVersion: 2,
    quantityReviewVersion: 2,
    participants: s.map((p) => ({
      collectorId: p.collectorId,
      allocations: p.materials,
    })),
  };
  assert.equal(
    Math.round(
      members.reduce((v, p) => v + creditedKg(c, p.collectorId), 0) * 1000,
    ),
    43000,
  );
  assert.equal(
    s[0].materials.find((m) => m.materialId === "litro")?.quantity,
    5,
  );
});
test("Parcela zero explícita é válida quando o material fecha exatamente", () => {
  const a = allocationSnapshot(materials.slice(0, 1), members, [
    { materialId: "kg", collectorId: "a", quantity: 40 },
    { materialId: "kg", collectorId: "b", quantity: 0 },
    { materialId: "kg", collectorId: "c", quantity: 0 },
  ]);
  assert.equal(a[1].materials[0].quantity, 0);
});
test("Material omitido ou participante repetido bloqueia o rateio", () => {
  assert.throws(() => allocationSnapshot(materials, members, items.slice(1)));
  assert.throws(() =>
    allocationSnapshot(materials, members, [...items.slice(1), items[1]]),
  );
});
test("Não aceita desvio de 0,001 entre o rateio e a pesagem", () =>
  assert.throws(() =>
    allocationSnapshot(
      materials,
      members,
      items.map((i, n) => (n ? i : { ...i, quantity: i.quantity + 0.001 })),
    ),
  ));
test("Não aceita material nem participante de outra coleta", () => {
  assert.throws(() =>
    allocationSnapshot(
      materials,
      members,
      items.map((i, n) => (n ? i : { ...i, collectorId: "estranho" })),
    ),
  );
  assert.throws(() =>
    allocationSnapshot(
      materials,
      members,
      items.map((i, n) => (n ? i : { ...i, materialId: "estranho" })),
    ),
  );
});
test("Pesagem posterior torna o crédito anterior pendente, preservando o histórico", () => {
  const c = {
    status: "RECEIVED",
    allocationVersion: 1,
    allocationQuantityVersion: 1,
    quantityReviewVersion: 2,
    participants: [
      { collectorId: "a", allocations: [{ quantity: 50, unit: "KG" }] },
    ],
  };
  assert.equal(creditedKg(c, "a"), 0);
  assert.equal(c.participants[0].allocations[0].quantity, 50);
});
test("Coleta individual legada mantém massa e canceladas não geram produção", () => {
  assert.equal(
    creditedKg(
      { status: "COMPLETED", collectorId: "a", totalWeightKg: 50 },
      "a",
    ),
    50,
  );
  assert.equal(
    creditedKg(
      { status: "CANCELLED", collectorId: "a", totalWeightKg: 50 },
      "a",
    ),
    0,
  );
  assert.equal(
    creditedKg(
      { status: "COMPLETED", collectorId: "a", totalWeightKg: 50 },
      "b",
    ),
    0,
  );
});

import { personalMaterialParcels } from "../../../src/utils/collectionParticipation";
test("Gráficos do App usam parcelas por material, preservando a coleta operacional", () => {
  const c: any = {
    status: "COMPLETED",
    myCollectorId: "a",
    allocationVersion: 1,
    quantityReviewVersion: 1,
    allocationQuantityVersion: 1,
    totalWeightKg: 40,
    materials: [{ name: "Papel", quantity: 40 }],
    participants: [
      {
        collectorId: "a",
        allocations: [
          { materialId: "m", name: "Papel", unit: "KG", quantity: 15 },
        ],
      },
    ],
  };
  assert.equal(personalMaterialParcels(c)[0].quantityKg, 15);
  assert.equal(c.materials[0].quantity, 40);
  assert.deepEqual(
    personalMaterialParcels({ ...c, quantityReviewVersion: 2 }),
    [],
  );
});
