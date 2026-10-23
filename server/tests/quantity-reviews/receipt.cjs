const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, "../../..");
function load(file) {
  const source = fs.readFileSync(file, "utf8");
  const mod = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (name) =>
      name === "react-native"
        ? { Platform: { OS: "web" } }
        : name.startsWith("expo-")
          ? {}
          : load(path.resolve(path.dirname(file), name + ".ts")),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const { buildReceiptHtml } = load(
  path.join(root, "src/services/pdfGenerator.ts"),
);
const result = buildReceiptHtml(
  { name: "Catador QA" },
  {
    id: "collection-qa",
    local: "Coleta",
    date: "23/10/2026",
    kg: 40,
    materials: [{ type: "Papelão", unit: "KG", quantity: 40, quantityKg: 40 }],
    quantityReviews: [
      {
        id: "review",
        version: 1,
        actorName: "<Cooperativa>",
        reason: "Pesagem na balança <conferida>",
        createdAt: "2026-10-23T15:00:00Z",
        items: [
          {
            name: "Papelão",
            unit: "KG",
            reportedQuantity: 50,
            previousQuantity: 50,
            confirmedQuantity: 40,
          },
        ],
      },
    ],
  },
);
assert.match(result.html, /Conferência 1 da cooperativa/);
assert.match(result.html, /50 kg/);
assert.match(result.html, /40 kg/);
assert.match(result.html, /&lt;Cooperativa&gt;/);
assert(!result.html.includes("<Cooperativa>"));
console.log(
  "PASS Comprovante do app preserva quantidade original, conferida e escape do histórico",
);
