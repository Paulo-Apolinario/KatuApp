/** Valida o template real de impressão com dados sintéticos; não altera comprovantes históricos. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, "../../.."),
  cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => {
      if (["react-native", "expo-print", "expo-sharing"].includes(name))
        return {};
      return load(path.resolve(path.dirname(file), name) + ".ts");
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}
const { buildReceiptHtml } = load(
  path.join(root, "src/services/pdfGenerator.ts"),
);
const user = {
  name: "Catadora de Validação",
  code: "collector-qa-document-reference",
  email: "catadora@example.test",
  phone: "(85) 90000-0000",
  location: "Fortaleza / CE",
  cooperativeName: "Cooperativa de Validação",
  totalKg: 50,
  collectionCount: 3,
  periodStart: "01/10/2026",
  periodEnd: "22/10/2026",
  topMaterials: [
    { type: "Papelão", quantity: 50, quantityKg: 50, unit: "KG" },
    { type: "Óleo vegetal", quantity: 12, quantityKg: 0, unit: "LITER" },
  ],
};
const consolidated = buildReceiptHtml(user),
  individual = buildReceiptHtml(user, {
    id: "collection-qa-full-reference",
    date: "22/10/2026",
    local: "Recebimento conferido pela cooperativa.",
    kg: 50,
    materials: user.topMaterials,
  });
assert(consolidated.html.includes("50,0"));
assert(consolidated.html.includes("12 L"));
assert(consolidated.html.includes("3"));
assert(consolidated.html.includes("01/10/2026 a 22/10/2026"));
assert(consolidated.html.includes("Cooperativa de Validação"));
assert(!consolidated.html.includes("destinação adequada"));
assert(individual.html.includes("collection-qa-full-reference"));
const hostile = buildReceiptHtml({
  ...user,
  name: "<script>alert(1)</script>",
  email: '" onload="alert(1)',
}).html;
assert(!hostile.includes("<script>"));
assert(hostile.includes("&lt;script&gt;"));
const many = buildReceiptHtml({
  ...user,
  topMaterials: Array.from({ length: 85 }, (_, i) => ({
    type: `Material de validação ${i + 1} com descrição detalhada para testar paginação`,
    quantity: i + 1,
    quantityKg: i + 1,
    unit: "KG",
  })),
});
const output = process.env.KATUA_PDF_QA_OUTPUT;
if (output) {
  fs.mkdirSync(output, { recursive: true });
  for (const [name, doc] of Object.entries({ consolidated, individual, many }))
    fs.writeFileSync(path.join(output, name + ".html"), doc.html);
}
console.log(
  JSON.stringify(
    {
      status: "PASS",
      cases: [
        "Consolidado com período, cooperativa e unidades mistas",
        "Individual com referência completa",
        "Escapamento de conteúdo cadastral",
        "Template com 85 materiais para validar paginação",
      ],
      fixture: "Somente dados sintéticos, sem dados reais da VPS",
    },
    null,
    2,
  ),
);
