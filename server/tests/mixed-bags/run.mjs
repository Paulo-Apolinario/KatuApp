// Disposable database only. Never loads application environment files.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const require = createRequire(
  path.resolve(
    process.env.KATUA_VALIDATION_TOOLS || "../../../validation-tools",
    "package.json",
  ),
);
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "katua-quick-registration-"));
let prior = fs.readFileSync("prisma/schema.prisma", "utf8");
prior = prior.replace(/\n\/\/ Physical mixed receipt[\s\S]*$/, "\n");
prior = prior.replace(/^  (mixedBags|bagOutputs|bagOutput|triageDays) [^\n]+\n/gm, "");
fs.writeFileSync(path.join(tmp, "before.prisma"), prior);
const ddl = spawnSync(
  process.execPath,
  [
    "node_modules/prisma/build/index.js",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    path.join(tmp, "before.prisma"),
    "--script",
  ],
  {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://127.0.0.1/disposable" },
  },
);
if (ddl.status) throw Error(ddl.stderr);
const db = await PGlite.create();
const server = new PGLiteSocketServer({
  db,
  host: "127.0.0.1",
  port: 54345,
  maxConnections: 1,
});
try {
  await db.exec(ddl.stdout);
  await db.exec(
    `INSERT INTO "User" (id,email,"passwordHash","displayName",role,"updatedAt") VALUES ('legacy-user','legacy@qa.invalid','unused','Legado','COOPERATIVE',now()); INSERT INTO "Cooperative" (id,name,"userId","updatedAt") VALUES ('legacy-coop','Cooperativa preservada','legacy-user',now()); INSERT INTO "Generator" (id,name,type,email,"cooperativeId","documentNumber","updatedAt") VALUES ('legacy-gen','Gerador preservado','SMALL','legacy-gen@qa.invalid','legacy-coop','52998224725',now()); INSERT INTO "Collector" (id,name,email,"cooperativeId","totalKg",status,"updatedAt") VALUES ('legacy-col','Catador preservado','legacy-col@qa.invalid','legacy-coop',125,'ON_ROUTE',now());`,
  );
  await db.exec(
    fs.readFileSync(
      "prisma/migrations/20261112210000_mixed_bag_sorting/migration.sql",
      "utf8",
    ),
  );
  await db.exec(fs.readFileSync('prisma/migrations/20261113000000_triage_controls/migration.sql','utf8'));
  const rows = await db.query(
    `SELECT email,"totalKg",status FROM "Collector" WHERE id='legacy-col'`,
  );
  if (
    rows.rows[0].email !== "legacy-col@qa.invalid" ||
    Number(rows.rows[0].totalKg) !== 125 ||
    rows.rows[0].status !== "ON_ROUTE"
  )
    throw Error("Migração alterou cadastro anterior.");
  console.log(
    "PASS: incremental migration preserves existing identities, stock-independent totals and operational status",
  );
  await server.start();
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/mixed-bags/integration.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:54345/postgres?connection_limit=1",
        JWT_SECRET: "quick-registration-local-secret-32-characters",
        NODE_ENV: "test",
        APP_ENV: "local",
        LOG_LEVEL: "silent",
        SMTP_HOST: "smtp.qa.invalid",
        SMTP_USER: "local",
        SMTP_PASS: "local-only",
        SMTP_FROM: "katua@qa.invalid",
        KATUA_MIXED_BAG_TEST: "1",
      },
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
} finally {
  await server.stop();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
