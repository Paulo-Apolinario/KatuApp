import test from "node:test";
import assert from "node:assert/strict";
import {
  referenceImpact,
  impactReference,
} from "../../src/modules/impact/impact-summary.service";
test("Modelo automático mantém os quatro coeficientes anteriores do App", () => {
  assert.deepEqual(referenceImpact(100), {
    co2Kg: 150,
    waterLiters: 3500,
    energyKwh: 229.99999999999997,
    treesEquivalent: 1,
  });
  assert.equal(impactReference.version, "katua-reference-v1");
});
test("Sem peso coletado os quatro indicadores são zero, sem exigir configuração", () =>
  assert.deepEqual(referenceImpact(0), {
    co2Kg: 0,
    waterLiters: 0,
    energyKwh: 0,
    treesEquivalent: 0,
  }));
test("Peso conferido substitui o peso anterior na referência sem multiplicar parcelas", () => {
  assert.equal(referenceImpact(50).co2Kg, 75);
  assert.equal(referenceImpact(40).co2Kg, 60);
  assert.equal(referenceImpact(40).treesEquivalent, 0.4);
});
