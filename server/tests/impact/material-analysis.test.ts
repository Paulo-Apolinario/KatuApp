import assert from "node:assert/strict";
import {
  materialProfileSchema,
  catalogDeclaration,
} from "../../src/modules/impact/material-profile";
import {
  selectedAnalysisMaterials,
  newImpactTotals,
  addImpact,
  finishImpact,
  civilDay,
} from "../../src/modules/impact/impact-analysis.model";
const checks: string[] = [];
const pass = (s: string) => checks.push(s);
const profile = materialProfileSchema.parse({
  materialCode: "PP",
  identification: "VERIFIED",
  identificationEvidence: "Marcação e conferência",
  responsible: "Técnico QA",
});
const catalog = new Map([["pp", { technicalProfile: profile }]]);
function collection(
  q = 80,
  unit = "KG",
  snapshot: any = { confirmed: { profile } },
) {
  return {
    id: "c1",
    status: "COMPLETED",
    collectedAt: new Date("2026-11-06T10:00:00Z"),
    quantitiesReviewedAt: new Date(),
    collectionMaterials: [
      {
        id: "m1",
        wasteTypeId: "pp",
        nameSnapshot: "Cadeira PP",
        unit,
        quantity: q,
        identificationSnapshot: snapshot,
      },
    ],
  };
}
const method = {
  calculationMode: "CUSTOM",
  approved: true,
  approvedBy: "Técnico QA",
  source: "Fonte demonstrativa de teste",
  version: "qa-v1",
  region: "CE",
  processScenario: "Cenário de teste, sem fator de produção",
  validFrom: "2026-01-01",
  factors: [
    {
      materialId: "pp",
      materialCode: "PP",
      co2PerKg: 2,
      waterPerKg: 3,
      treesPerKg: 9,
    },
  ],
};
function sum(c: any, m: any = method) {
  const t = newImpactTotals();
  addImpact(t, c, selectedAnalysisMaterials(c, catalog, {}), m);
  return finishImpact(t);
}
assert.equal(sum(collection()).co2Kg, 160);
pass("Fator por item e quantidade conferida");
assert.equal(sum(collection(), { ...method, approved: false }).co2Kg, null);
pass("Sem validação não há fator genérico");
assert.equal(
  sum({ ...collection(), quantitiesReviewedAt: null }).confirmedMassKg,
  0,
);
assert.equal(sum({ ...collection(), quantitiesReviewedAt: null }).co2Kg, null);
pass("COMPLETED não substitui conferência do peso");
assert.equal(sum(collection(80, "LITER")).units.LITER, 80);
assert.equal(sum(collection(80, "LITER")).totalMassKg, 0);
assert.equal(sum(collection(80, "LITER")).co2Kg, null);
pass("Litros preservados sem conversão arbitrária");
assert.equal(sum(collection(0.08, "TON")).totalMassKg, 80);
pass("Toneladas convertidas somente para kg");
assert.equal(
  sum(collection(80, "KG", catalogDeclaration(profile))).co2Kg,
  null,
);
pass("Declaração do catálogo não confirma composição na coleta");
assert.equal(sum(collection(80, "KG", null)).currentMappingUnits.KG, 80);
assert.equal(sum(collection(80, "KG", null)).co2Kg, null);
pass("Legado explicita vínculo atual sem reclassificação histórica");
assert.equal(
  sum(collection(), { ...method, validUntil: "2026-10-31" }).co2Kg,
  null,
);
pass("Fator fora do período de aplicação não é utilizado");
assert.equal(sum(collection()).treesEquivalent, null);
pass("PP não gera árvores equivalentes");
assert.equal(
  sum(collection(), {
    ...method,
    factors: [{ materialId: "pp", materialCode: "PP", co2PerKg: -2 }],
  }).co2Kg,
  -160,
);
pass("Estimativa desfavorável não é ocultada");
assert.equal(
  sum(collection(), {
    ...method,
    factors: [{ materialId: "pp", materialCode: "PP", co2PerKg: 0 }],
  }).co2Kg,
  0,
);
pass("Zero documentado difere de ausência de fator");
assert.equal(
  selectedAnalysisMaterials(collection(), catalog, { materialId: "outro" })
    .length,
  0,
);
pass("Filtro por identificador não confunde nomes");
assert.equal(civilDay("2026-11-01T02:59:59Z"), "2026-10-31");
pass("Datas civis de Fortaleza");
assert(
  !materialProfileSchema.safeParse({
    standardEdition: "2024",
    hazardClass: "CLASS_II_A",
  }).success,
);
assert(
  !materialProfileSchema.safeParse({ classificationStatus: "DOCUMENTED" })
    .success,
);
pass("Classificação exige edição compatível e documentação");
assert(!materialProfileSchema.safeParse({ technicalCode: "123" }).success);
pass("Código técnico exige lista e versão");
assert.equal(
  sum(collection(), {
    ...method,
    factors: [{ materialId: "pp", materialCode: "COPPER", co2PerKg: 2 }],
  }).co2Kg,
  null,
);
pass("Fator de outra composição não é aplicado ao item");
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
