import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
const toolsRoot = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsRoot) throw Error("Informe KATUA_VALIDATION_TOOLS.");
const require = createRequire(path.resolve(toolsRoot, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "katua-field-"));
const schema = fs
  .readFileSync(root + "/prisma/schema.prisma", "utf8")
  .replace(/^  @@index\(\[(?:requestedByUserId, createdAt, id|generatorId, createdAt, id|cooperativeId, status, createdAt, id|driverId, status, createdAt, id|driverId, createdAt, id)\]\)\n/gm, "")
  .replace(/^  (?:savedAddresses Json @default\("\[\]"\)|requestOperationId String\? @unique|requestOperationHash String\?)\n/gm, "")
  .replace(/model Generator \{[\s\S]*?\n\}/, block => block.split("\n").filter(line => !/^\s*documentNumber\s/.test(line) && !line.includes("@@unique([cooperativeId, documentNumber])")).join("\n"))
  .replace(/model Route \{[\s\S]*?\n\}/, (block) =>
    block
      .split("\n")
      .filter(
        (line) =>
          !/^\s*(startedAt|operationalEvents|closureOutcome|closedAt)\s/.test(line) &&
          !line.includes("@@index([cooperativeId, status, startedAt])") &&
          !line.includes("@@index([cooperativeId, planId, scheduledDate])"),
      )
      .join("\n"),
  );
fs.writeFileSync(tmp + "/before.prisma", schema);
const ddl = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    tmp + "/before.prisma",
    "--script",
  ],
  { cwd: root, encoding: "utf8" },
);
if (ddl.status !== 0) throw Error(ddl.stderr);
const db = await PGlite.create();
await db.exec(ddl.stdout);
await db.exec(
  `INSERT INTO "User" (id,email,"passwordHash","displayName",role,"updatedAt") VALUES ('old-field-owner','old-field@test.invalid','unused-local','Histórica QA','COOPERATIVE',now()); INSERT INTO "Cooperative" (id,"userId",name,"updatedAt") VALUES ('old-field-coop','old-field-owner','Histórica QA',now()); INSERT INTO "Route" (id,"cooperativeId",name,status,stops,"collectionOrder","collectorIds","updatedAt") VALUES ('route-before-field-migration','old-field-coop','Histórica QA','IN_PROGRESS','{}','{point-before-field-migration}','{}',now()); INSERT INTO "Collection" (id,"cooperativeId","routeId",status,"updatedAt") VALUES ('point-before-field-migration','old-field-coop','route-before-field-migration','COLLECTED',now());`,
);
await db.exec(
  fs.readFileSync(
    root +
      "/prisma/migrations/20261028030000_route_field_operations/migration.sql",
    "utf8",
  ),
);
await db.exec(fs.readFileSync(root + "/prisma/migrations/20261028040000_app_history_pagination/migration.sql", "utf8"));
await db.exec(`INSERT INTO "User" (id,email,"passwordHash","displayName",role,"updatedAt") VALUES ('residential-before-migration','res-old@test.invalid','unused','Residencial antiga','PF',now()); INSERT INTO "PersonProfile" (id,"userId",cpf,address,"updatedAt") VALUES ('residential-profile-before-migration','residential-before-migration','11111111111','Endereço preservado',now());`);
await db.exec(fs.readFileSync(root + "/prisma/migrations/20261028050000_residential_workspace/migration.sql", "utf8"));
await db.exec(fs.readFileSync(root + "/prisma/migrations/20261029010000_route_pending_outcomes/migration.sql", "utf8"));
await db.exec(`INSERT INTO "Generator" (id,"cooperativeId",type,name,email,"totalKg","updatedAt") VALUES ('generator-before-document','old-field-coop','SMALL','Gerador histórico preservado','old-generator-doc@test.invalid',42,now());`);
await db.exec(fs.readFileSync(root + "/prisma/migrations/20261030010000_generator_document/migration.sql", "utf8"));
const server = new PGLiteSocketServer({ db, port: 54329, host: "127.0.0.1" });
await server.start();
try {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/field-operations/integration.ts"],
    {
      cwd: root,
      env: {
        ...process.env,
        KATUA_LOCAL_VALIDATION: "1",
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1",
      },
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  let uiPromise;
  child.stdout.on("data", (b) => {
    process.stdout.write(b);
    if (
      (process.env.FIELD_UI === "1" || process.env.RESIDENTIAL_UI === "1" || process.env.GENERATOR_DOCUMENT_UI === "1") &&
      !uiPromise &&
      b.toString().includes("FIELD_UI_READY")
    )
      uiPromise = new Promise((resolve) => {
        const ui = spawn(
          process.execPath,
          [process.env.GENERATOR_DOCUMENT_UI === "1" ? "tests/generator-document/browser.mjs" : process.env.RESIDENTIAL_UI === "1" ? "tests/residential/browser.mjs" : "tests/field-operations/browser.mjs"],
          { cwd: root, env: process.env, stdio: "inherit" },
        );
        ui.on("exit", (code) => {
          child.kill("SIGTERM");
          resolve(code);
        });
      });
  });
  const status = await new Promise((resolve, reject) => {
    child.on("exit", resolve);
    child.on("error", reject);
  });
  process.exitCode = (uiPromise ? await uiPromise : status) || 0;
} finally {
  await server.stop();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
