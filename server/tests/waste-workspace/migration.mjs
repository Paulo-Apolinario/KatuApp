/** Verifica migração sobre dados legados em PostgreSQL descartável em memória. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  repo = path.resolve(root, "..");
const req = createRequire(
  path.resolve(process.env.KATUA_VALIDATION_TOOLS, "package.json"),
);
const { PGlite } = req("@electric-sql/pglite");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "katua-waste-migration-"));
// Retira somente os campos novos para construir a versão anterior sem depender do HEAD local.
let schema = fs
  .readFileSync(root + "/prisma/schema.prisma", "utf8")
  .replace(
    "  operationId String? @unique\n  operationHash String?\n  version Int @default(1)\n  lastOperationId String? @unique\n  lastOperationHash String?\n",
    "",
  )
  .replace(
    "  normalizedName String?\n  @@unique([cooperativeId, normalizedName])\n",
    "",
  );
fs.writeFileSync(dir + "/before.prisma", schema);
const sql = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    dir + "/before.prisma",
    "--script",
  ],
  { cwd: root, encoding: "utf8" },
);
assert.equal(sql.status, 0, sql.stderr);
const db = await PGlite.create();
await db.exec(sql.stdout);
async function seed(table, id, values = {}) {
  const data = { id, ...values };
  for (const c of (
    await db.query(
      "SELECT column_name,data_type,udt_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_nullable=$3 AND column_default IS NULL",
      ["public", table, "NO"],
    )
  ).rows) {
    if (c.column_name in data) continue;
    let v;
    switch (c.data_type) {
      case "USER-DEFINED":
        v = (
          await db.query(
            "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 ORDER BY e.enumsortorder LIMIT 1",
            [c.udt_name],
          )
        ).rows[0].enumlabel;
        break;
      case "jsonb":
        v = "{}";
        break;
      case "timestamp without time zone":
        v = new Date();
        break;
      case "boolean":
        v = false;
        break;
      case "integer":
      case "double precision":
      case "numeric":
        v = 1;
        break;
      case "ARRAY":
        v = [];
        break;
      default:
        v = id + "-" + c.column_name;
    }
    data[c.column_name] = v;
  }
  const e = Object.entries(data);
  await db.query(
    `INSERT INTO "${table}" (${e.map(([k]) => '"' + k + '"').join(",")}) VALUES (${e.map((_, i) => "$" + (i + 1)).join(",")})`,
    e.map(([, v]) => v),
  );
}
await seed("User", "u", { role: "COOPERATIVE" });
await seed("Cooperative", "c", { userId: "u" });
await seed("WasteStockItem", "i1", { cooperativeId: "c", name: "Papel" });
await seed("WasteStockItem", "i2", { cooperativeId: "c", name: " papel " });
await seed("WasteStockItem", "i3", { cooperativeId: "c", name: "Plástico" });
await seed("Collection", "col", {
  cooperativeId: "c",
  status: "COMPLETED",
  quantityReviewVersion: 1,
});
await seed("CollectionMaterial", "mat", {
  collectionId: "col",
  quantity: 50,
  unit: "KG",
});
await seed("CollectionWasteEntry", "entry", {
  cooperativeId: "c",
  collectionId: "col",
  collectionMaterialId: "mat",
  collectedQuantity: 50,
  destinedQuantity: 50,
  remainingQuantity: 0,
  unit: "KG",
});
await seed("WasteStockLot", "lot", {
  cooperativeId: "c",
  stockItemId: "i1",
  quantity: 50,
  availableQuantity: 50,
  unit: "KG",
});
await seed("CollectionWasteDestination", "dest", {
  cooperativeId: "c",
  collectionWasteEntryId: "entry",
  stockItemId: "i1",
  stockLotId: "lot",
  type: "STOCK",
  quantity: 50,
  unit: "KG",
});
await seed("CollectionWasteDestinationEvent", "event", {
  destinationId: "dest",
  actorUserId: "u",
});
const before = (await db.query('SELECT * FROM "CollectionWasteDestination"'))
    .rows[0],
  audit = (await db.query('SELECT * FROM "CollectionWasteDestinationEvent"'))
    .rows;
await db.exec(
  fs.readFileSync(
    root +
      "/prisma/migrations/20261028010000_waste_workspace_integrity/migration.sql",
    "utf8",
  ),
);
const after = (await db.query('SELECT * FROM "CollectionWasteDestination"'))
  .rows[0];
assert.deepEqual(
  Object.fromEntries(Object.keys(before).map((k) => [k, after[k]])),
  before,
);
assert.equal(after.version, 1);
assert.equal(after.operationId, null);
assert.deepEqual(
  (await db.query('SELECT * FROM "CollectionWasteDestinationEvent"')).rows,
  audit,
);
const items = (
  await db.query('SELECT id,"normalizedName" FROM "WasteStockItem" ORDER BY id')
).rows;
assert.equal(items[0].normalizedName, null);
assert.equal(items[1].normalizedName, null);
assert.equal(items[2].normalizedName, "plástico");
await assert.rejects(
  db.query(
    'INSERT INTO "WasteStockItem" (id,"cooperativeId",name,"normalizedName",category,"updatedAt") VALUES ($1,$2,$3,$4,$5,now())',
    ["duplicate", "c", "PLÁSTICO", "plástico", "Papel"],
  ),
  /unique|duplicate/i,
);
const checks = [
  "Migração preserva destinação, quantidades, lote e auditoria existentes; versão inicial 1 sem inventar identificador de operação",
  "Nomes duplicados históricos permanecem sem exclusão ou fusão automática; nomes inequívocos recebem normalização",
  "Índice único impede novo nome normalizado repetido na mesma cooperativa",
];
console.log(checks.map((c) => "PASS " + c).join("\n"));
fs.writeFileSync(
  path.resolve(
    process.env.KATUA_VALIDATION_TOOLS,
    "waste-workspace-migration-results.json",
  ),
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
await db.close();
fs.rmSync(dir, { recursive: true, force: true });
