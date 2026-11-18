// Runs exclusively against a new, disposable local database; no .env loading.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(path.resolve(process.env.KATUA_VALIDATION_TOOLS || "../../../validation-tools", "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ddl = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], {
  cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://127.0.0.1/disposable" },
});
if (ddl.status) throw Error(ddl.stderr);
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 54347, maxConnections: 1 });
try {
  await db.exec(ddl.stdout);
  await server.start();
  const child = spawn(process.execPath, ["--import", "tsx", "tests/cooperative-intakes/integration.ts"], {
    cwd: root, stdio: "inherit", env: { ...process.env, DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54347/postgres?connection_limit=1", JWT_SECRET: "cooperative-intakes-disposable-local-secret", NODE_ENV: "test", APP_ENV: "local", LOG_LEVEL: "silent", KATUA_INTAKES_TEST: "1" },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
} finally { await server.stop(); await db.close(); }
