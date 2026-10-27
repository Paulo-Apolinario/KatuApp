/** Somente PostgreSQL descartável em memória. Nunca lê DATABASE_URL ou conecta à VPS. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const req = createRequire(
  path.resolve(process.env.KATUA_VALIDATION_TOOLS || ".", "package.json"),
);
const { PGlite } = req("@electric-sql/pglite");
const cli = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { cwd: serverRoot, encoding: "utf8" },
);
assert.equal(cli.status, 0, cli.stderr);
const source = fs.readFileSync(
  path.join(serverRoot, "scripts/excluir-cooperativa-teste.sql"),
  "utf8",
);
function script(email = "owner@test.invalid", cnpj = "11111111000111") {
  const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
  return source
    .replace(/^\\.*$/gm, "")
    .replaceAll(":'email'", quote(email))
    .replaceAll(":'cnpj'", quote(cnpj));
}
const db = await PGlite.create();
await db.exec(cli.stdout);
const fields = new Map();
async function insert(table, id, provided = {}) {
  if (!fields.has(table))
    fields.set(
      table,
      (
        await db.query(
          `SELECT column_name,is_nullable,column_default,data_type,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
          [table],
        )
      ).rows,
    );
  const vals = { id, ...provided };
  for (const f of fields.get(table)) {
    if (
      f.column_name in vals ||
      f.is_nullable === "YES" ||
      f.column_default !== null
    )
      continue;
    let value;
    switch (f.data_type) {
      case "USER-DEFINED":
        value = (
          await db.query(
            `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 ORDER BY e.enumsortorder LIMIT 1`,
            [f.udt_name],
          )
        ).rows[0].enumlabel;
        break;
      case "integer":
      case "bigint":
      case "double precision":
      case "numeric":
        value = 1;
        break;
      case "boolean":
        value = false;
        break;
      case "timestamp without time zone":
      case "timestamp with time zone":
        value = new Date();
        break;
      case "jsonb":
      case "json":
        value = {};
        break;
      case "ARRAY":
        value = [];
        break;
      default:
        value = id + "-" + f.column_name;
    }
    vals[f.column_name] = value;
  }
  const entries = Object.entries(vals);
  await db.query(
    `INSERT INTO public."${table}" (${entries.map(([k]) => '"' + k + '"').join(",")}) VALUES (${entries.map((_, i) => "$" + (i + 1)).join(",")})`,
    entries.map(([k, v]) => {
      const f = fields.get(table).find((f) => f.column_name === k);
      return f?.data_type === "jsonb" ? JSON.stringify(v) : v;
    }),
  );
  return id;
}
async function seed(prefix, cnpj, email) {
  const owner = await insert("User", prefix + "-owner", {
    email,
    role: "COOPERATIVE",
  });
  const coop = await insert("Cooperative", prefix + "-coop", {
    userId: owner,
    registrationNumber: cnpj,
    email: prefix + "@company.invalid",
  });
  const collectorUser = await insert("User", prefix + "-worker", {
    email: prefix + "-worker@test.invalid",
    role: "COLLECTOR",
  });
  const collector = await insert("Collector", prefix + "-collector", {
    cooperativeId: coop,
    userId: collectorUser,
  });
  const gen = await insert("Generator", prefix + "-gen", {
    cooperativeId: coop,
    email: prefix + "-gen@test.invalid",
  });
  const bin = await insert("Bin", prefix + "-bin", { cooperativeId: coop });
  const route = await insert("Route", prefix + "-route", {
    cooperativeId: coop,
  });
  const schedule = await insert("Schedule", prefix + "-schedule", {
    cooperativeId: coop,
    requestedByUserId: owner,
    generatorId: gen,
  });
  const col = await insert("Collection", prefix + "-col", {
    cooperativeId: coop,
    collectorId: collector,
    generatorId: gen,
    binId: bin,
    routeId: route,
    scheduleId: schedule,
  });
  await insert("Collection", prefix + "-col2", { cooperativeId: coop });
  const item = await insert("WasteStockItem", prefix + "-item", {
    cooperativeId: coop,
  });
  const mat = await insert("CollectionMaterial", prefix + "-mat", {
    collectionId: col,
    wasteTypeId: item,
  });
  const entry = await insert("CollectionWasteEntry", prefix + "-entry", {
    cooperativeId: coop,
    collectionId: col,
    collectionMaterialId: mat,
    wasteTypeId: item,
  });
  const lot = await insert("WasteStockLot", prefix + "-lot", {
    cooperativeId: coop,
    stockItemId: item,
    originCollectionId: col,
  });
  const dest = await insert("CollectionWasteDestination", prefix + "-dest", {
    cooperativeId: coop,
    collectionWasteEntryId: entry,
    stockItemId: item,
    stockLotId: lot,
  });
  await insert("CollectionWasteDestinationEvent", prefix + "-audit", {
    destinationId: dest,
    actorUserId: owner,
  });
  await insert("CollectionIncident", prefix + "-incident", {
    cooperativeId: coop,
    collectionId: col,
  });
  const order = await insert("ExtraCollectionOrder", prefix + "-oc", {
    cooperativeId: coop,
    collectorId: collector,
    contextRouteId: route,
    sourceScheduleId: schedule,
    collectionId: col,
  });
  await insert("ExtraCollectionOrderEvent", prefix + "-oce", {
    orderId: order,
  });
  await insert("OwnerDocument", prefix + "-doc", {
    cooperativeId: coop,
    generatorId: gen,
  });
  await insert("BinEvent", prefix + "-be", { cooperativeId: coop, binId: bin });
  const pr = await insert("PevRequest", prefix + "-pr", {
    cooperativeId: coop,
    binId: bin,
    requesterUserId: owner,
    collectionId: col,
  });
  await insert("PevRequestUpdate", prefix + "-pru", { requestId: pr });
  const unit = await insert("EnvironmentalUnit", prefix + "-unit", {
    cooperativeId: coop,
  });
  const doc = await insert("EnvironmentalDocument", prefix + "-envdoc", {
    unitId: unit,
  });
  await insert("EnvironmentalEvent", prefix + "-envevent", { documentId: doc });
  await insert("EnvironmentalAttachment", prefix + "-envfile", {
    documentId: doc,
  });
  await insert("EnvironmentalMunicipalAccess", prefix + "-envaccess", {
    userId: owner,
  });
  await insert("CollectionParticipant", prefix + "-participant", {
    collectionId: col,
    collectorId: collector,
  });
  await insert("CollectionAllocationReview", prefix + "-allocation", {
    collectionId: col,
  });
  await db.query(
    'INSERT INTO "CooperativeSettings" ("cooperativeId",payload,"updatedAt") VALUES ($1,$2,now())',
    [coop, "{}"],
  );
  return { owner, coop, collectorUser, gen, col, dest };
}
const a = await seed("a", "11111111000111", "owner@test.invalid");
const b = await seed("b", "22222222000122", "other@test.invalid");
async function snapshot() {
  const all = {};
  for (const { table_name } of (
    await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
    )
  ).rows)
    all[table_name] = (
      await db.query(
        `SELECT to_jsonb(t) AS row FROM public."${table_name}" t ORDER BY to_jsonb(t)::text`,
      )
    ).rows;
  return all;
}
const checks = [];
function pass(s) {
  checks.push(s);
  console.log("PASS", s);
}
let before = await snapshot();
await assert.rejects(db.exec(script("wrong@test.invalid")), /CNPJ e email/);
await db.exec("ROLLBACK");
assert.deepEqual(await snapshot(), before);
pass("email incorreto não altera registro algum");
await assert.rejects(
  db.exec(script("owner@test.invalid", "22222222000122")),
  /CNPJ e email/,
);
await db.exec("ROLLBACK");
assert.deepEqual(await snapshot(), before);
pass("CNPJ de outra cooperativa não altera registro algum");
await db.query('UPDATE "Collection" SET "generatorId"=$1 WHERE id=$2', [
  a.gen,
  b.col,
]);
before = await snapshot();
await assert.rejects(db.exec(script()), /Vínculo externo/);
await db.exec("ROLLBACK");
assert.deepEqual(await snapshot(), before);
pass("vínculo entre cooperativas bloqueia sem alterações");
await db.query('UPDATE "Collection" SET "generatorId"=$1 WHERE id=$2', [
  b.gen,
  b.col,
]);
await db.exec(
  'CREATE TABLE "CleanupUnexpectedChild" (id text PRIMARY KEY,"destinationId" text REFERENCES "CollectionWasteDestination"(id) ON DELETE RESTRICT)',
);
await db.query('INSERT INTO "CleanupUnexpectedChild" VALUES ($1,$2)', [
  "blocked",
  a.dest,
]);
before = await snapshot();
await assert.rejects(db.exec(script()), /CleanupUnexpectedChild|foreign key/);
await db.exec("ROLLBACK");
assert.deepEqual(await snapshot(), before);
pass("dependência inesperada restaura inclusive históricos já removidos");
await db.exec('DROP TABLE "CleanupUnexpectedChild"');
before = await snapshot();
await db.exec(script());
const after = await snapshot();
assert.equal(after.Cooperative.length, 1);
assert.equal(after.Cooperative[0].row.id, b.coop);
assert(!after.User.some((r) => r.row.id === a.owner));
assert(after.User.some((r) => r.row.id === a.collectorUser));
for (const [name, rows] of Object.entries(after))
  for (const { row } of rows) {
    if (name === "User" && row.id === a.collectorUser) continue;
    assert(!JSON.stringify(row).includes("a-"), name + " retains target");
  }
pass(
  "remove cadastro, duas coletas, lote e dependências de teste; preserva conta do colaborador",
);
for (const [name, rows] of Object.entries(before)) {
  const foreign = rows.filter(({ row }) =>
    String(row.id || row.cooperativeId || "").startsWith("b-"),
  );
  for (const row of foreign)
    assert(
      after[name].some((r) => JSON.stringify(r) === JSON.stringify(row)),
      name + " foreign changed",
    );
}
pass("cooperativa alheia e seus históricos permanecem idênticos");
before = await snapshot();
await assert.rejects(db.exec(script()), /CNPJ e email/);
await db.exec("ROLLBACK");
assert.deepEqual(await snapshot(), before);
pass("repetição não atinge outra cooperativa");
await db.close();
const report =
  process.env.KATUA_CLEANUP_RESULT ||
  path.join(os.tmpdir(), "katua-cooperative-cleanup-results.json");
fs.writeFileSync(
  report,
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
