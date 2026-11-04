import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
if (!process.env.KATUA_VALIDATION_TOOLS)
  throw Error("Informe KATUA_VALIDATION_TOOLS com PGlite e socket locais.");
const require = createRequire(
  path.resolve(process.env.KATUA_VALIDATION_TOOLS, "package.json"),
);
const { PGlite } = require("@electric-sql/pglite"),
  { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "katua-agents-"));
const schema = fs
  .readFileSync(root + "/prisma/schema.prisma", "utf8")
  .split("// Agents v1:")[0]
  .replace(/^  agent\w+ Agent\w+\[\]\n/gm, "");
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
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://localhost/disposable" },
  },
);
if (ddl.status !== 0) throw Error(ddl.stderr);
const db = await PGlite.create();
let server;
try {
  await db.exec(ddl.stdout);
  await db.exec(
    `INSERT INTO "User" (id,email,"passwordHash","displayName",role,"updatedAt") VALUES ('preserved-owner','preserved@qa.invalid','unused','Anterior','COOPERATIVE',now()); INSERT INTO "Cooperative" (id,"userId",name,"updatedAt") VALUES ('preserved-coop','preserved-owner','Anterior',now()); INSERT INTO "SystemAlert" (id,"cooperativeId",key,category,priority,title,message,link,"updatedAt") VALUES ('preserved-alert','preserved-coop','qa:previous','PROFILE','INFO','Anterior','Preservar','/settings',now());`,
  );
  const before = await db.query(
    "SELECT * FROM \"SystemAlert\" WHERE id='preserved-alert'",
  );
  await db.exec(
    fs.readFileSync(
      root + "/prisma/migrations/20261104020000_agents_v1/migration.sql",
      "utf8",
    ),
  );
  const after = await db.query(
    "SELECT * FROM \"SystemAlert\" WHERE id='preserved-alert'",
  );
  if (JSON.stringify(before.rows) !== JSON.stringify(after.rows))
    throw Error("Migração alterou dados anteriores");
  console.log(
    "PASS migration: schema anterior + migração incremental preservam alertas e cooperativa",
  );
  server = new PGLiteSocketServer({ db, port: 54329, host: "127.0.0.1" });
  await server.start();
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/agents/integration.ts"],
    {
      cwd: root,
      env: {
        ...process.env,
        KATUA_AGENTS_LOCAL_VALIDATION: "1",
        NODE_ENV: "test",
        APP_ENV: "local",
        LOG_LEVEL: "silent",
        AGENTS_ENABLED: "true",
        JWT_SECRET: "agents-test-only-secret-at-least-32-characters",
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1",
      },
      stdio: "inherit",
    },
  );
  const code = await new Promise((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
  process.exitCode = code || 0;
} finally {
  if (server) await server.stop();
  await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
