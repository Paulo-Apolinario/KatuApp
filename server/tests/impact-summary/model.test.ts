import test from "node:test";
import assert from "node:assert/strict";
import {
  newImpactTotals,
  finishImpact,
} from "../../src/modules/impact/impact-analysis.model";
test("Sem metodologia não há estimativa genérica por kg", () => {
  const totals = newImpactTotals();
  totals.totalMassKg = 100;
  const result = finishImpact(totals);
  assert.equal(result.co2Kg, null);
  assert.equal(result.waterLiters, null);
  assert.equal(result.energyKwh, null);
  assert.equal(result.treesEquivalent, null);
});
test("Sem fator não equivale a benefício zero", () =>
  assert.equal(finishImpact(newImpactTotals()).co2Kg, null));
test("Abrangência depende da massa que tem fator aplicável", () => {
  const totals = newImpactTotals();
  totals.totalMassKg = 100;
  totals.metrics.co2Kg = { value: 60, coveredMassKg: 40 };
  assert.equal(finishImpact(totals).coveragePercent, 40);
});
