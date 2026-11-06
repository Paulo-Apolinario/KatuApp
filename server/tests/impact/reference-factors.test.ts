import assert from "node:assert/strict";
import {
  referenceFactors,
  referenceMatch,
  SHORT_TON_KG,
  MMBTU_TO_KWH,
} from "../../src/modules/impact/reference-factors";
import {
  addImpact,
  selectedAnalysisMaterials,
  newImpactTotals,
  finishImpact,
} from "../../src/modules/impact/impact-analysis.model";
const checks: string[] = [];
const pass = (s: string) => checks.push(s);
const cardboard = referenceFactors.find((f) => f.id === "CORRUGATED")!;
assert(
  Math.abs(cardboard.co2PerKg - ((0.18 - -3.14) * 1000) / 907.18474) < 1e-10,
);
pass("CO2 usa diferença de cenários e short ton, não tonelada métrica");
assert(
  Math.abs(
    cardboard.energyPerKg - ((-0.21 - -15.1) * 293.0710701722222) / 907.18474,
  ) < 1e-10,
);
pass("Energia usa diferença entre aterro e reciclagem e conversão Btu");
assert.equal(referenceMatch({ name: "Papelão" }).factor?.id, "CORRUGATED");
assert.equal(
  referenceMatch({ name: "Cadeira branca", subcategory: "PP (Polipropileno)" })
    .factor?.id,
  "PP",
);
pass("Papelão e polímero declarado no catálogo têm correspondência");
assert.equal(referenceMatch({ name: "Cadeira branca" }).factor, null);
assert.equal(referenceMatch({ name: "Balde azul" }).factor, null);
pass("Cor e formato não inventam polímero");
assert.equal(
  referenceMatch({ name: "Alumínio Latinha" }).factor?.id,
  "ALUMINUM_CANS",
);
assert.equal(referenceMatch({ name: "Alumínio Panela" }).factor, null);
assert.equal(referenceMatch({ name: "Alumínio Misto" }).factor, null);
pass("Alumínio não usa indiscriminadamente fator de latinha");
assert.equal(referenceMatch({ name: "Cobre" }).factor, null);
assert.equal(
  referenceMatch({ name: "Fio de cobre" }).factor?.id,
  "COPPER_WIRE",
);
pass("Cobre não especificado não vira automaticamente fio");
assert.equal(
  referenceMatch({ name: "Papel e PP" }).reason,
  "AMBIGUOUS_MATERIAL",
);
assert.equal(
  referenceMatch({ name: "PP", profile: { materialCode: "PET" } }).reason,
  "AMBIGUOUS_MATERIAL",
);
pass("Descrições conflitantes ficam pendentes");
for (const name of [
  "Óleo",
  "Eletrônico linha branca",
  "PVC",
  "PS",
  "PEBD",
  "Coco",
  "Vidro temperado",
  "Vidro contaminado",
]) {
  assert.equal(referenceMatch({ name }).factor, null);
}
pass("Materiais sem cenário compatível não recebem fator genérico");
assert(
  referenceFactors.every((f) => f.waterPerKg === null && f.treesPerKg === null),
);
pass(
  "Captação primária de água não vira economia e árvores não são inventadas",
);
const c = {
  id: "c",
  status: "COLLECTED",
  collectedAt: new Date(),
  quantitiesReviewedAt: null,
  collectionMaterials: [
    {
      id: "m",
      wasteTypeId: "paper",
      nameSnapshot: "Papelão",
      quantity: 100,
      unit: "KG",
    },
  ],
};
const totals = newImpactTotals();
addImpact(totals, c, selectedAnalysisMaterials(c, new Map(), {}), {});
const result = finishImpact(totals);
assert.equal(result.co2Kg, 100 * cardboard.co2PerKg);
assert.equal(result.referenceProvisionalMassKg, 100);
assert.equal(result.confirmedMassKg, 0);
pass(
  "Referência automática calcula e distingue quantidade provisória sem falsificar conferência",
);
const disabled = newImpactTotals();
addImpact(disabled, c, selectedAnalysisMaterials(c, new Map(), {}), {
  calculationMode: "DISABLED",
});
assert.equal(finishImpact(disabled).co2Kg, null);
pass("Cooperativa pode desativar estimativas");
const liter = {
  ...c,
  collectionMaterials: [{ ...c.collectionMaterials[0], unit: "LITER" }],
};
const l = newImpactTotals();
addImpact(l, liter, selectedAnalysisMaterials(liter, new Map(), {}), {});
assert.equal(l.units.LITER, 100);
assert.equal(l.totalMassKg, 0);
assert.equal(l.metrics.co2Kg.value, null);
pass("Referência não converte litros arbitrariamente");
assert.equal(
  selectedAnalysisMaterials(c, new Map(), { materialCode: "CARDBOARD" }).length,
  1,
);
pass("Filtro por material encontra correspondência de referência legada");
const confirmedUnknown = {
  ...c,
  collectionMaterials: [
    {
      ...c.collectionMaterials[0],
      identificationSnapshot: {
        confirmed: { profile: { materialCode: "UNKNOWN" } },
      },
    },
  ],
};
const u = newImpactTotals();
addImpact(
  u,
  confirmedUnknown,
  selectedAnalysisMaterials(confirmedUnknown, new Map(), {}),
  {},
);
assert.equal(u.metrics.co2Kg.value, null);
pass("Revisão explícita como desconhecido é respeitada");
assert.equal(SHORT_TON_KG, 907.18474);
assert.equal(MMBTU_TO_KWH, 293.0710701722222);
pass("Constantes de conversão preservadas");
const zero = {
  ...c,
  collectionMaterials: [{ ...c.collectionMaterials[0], quantity: 0 }],
};
const z = newImpactTotals();
addImpact(z, zero, selectedAnalysisMaterials(zero, new Map(), {}), {});
assert.equal(z.metrics.co2Kg.value, null);
assert.equal(z.factorDiagnostics.MISSING_QUANTITY.KG, 0);
pass("Quantidade a pesar não vira estimativa zero presumida");
assert.equal(
  referenceMatch({ name: "Papelão", referenceWasteClass: "CLASS_I" }).reason,
  "CONDITIONS_REVIEW",
);
pass("Classificação perigosa legada exige revisão antes de usar referência");
const saved = {
  ...c,
  collectionMaterials: [
    {
      ...c.collectionMaterials[0],
      wasteTypeId: "pp",
      nameSnapshot: "Cadeira",
      identificationSnapshot: { declared: { materialCode: "PP" } },
    },
  ],
};
const laterCatalog = new Map([
  ["pp", { subcategory: "PET", technicalProfile: { materialCode: "PET" } }],
]);
const savedMs = selectedAnalysisMaterials(saved, laterCatalog, {});
assert.equal(savedMs[0].referenceFactor?.materialCode, "PP");
const oldUnknown = {
  ...saved,
  collectionMaterials: [
    {
      ...saved.collectionMaterials[0],
      identificationSnapshot: { declared: { materialCode: "UNKNOWN" } },
    },
  ],
};
assert.equal(
  selectedAnalysisMaterials(oldUnknown, laterCatalog, { materialCode: "PET" })
    .length,
  1,
);
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
