// Runs exclusively against a new, disposable local database; no .env loading.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
const require = createRequire(path.resolve(process.env.KATUA_VALIDATION_TOOLS || "../../../validation-tools", "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "katua-simulation-"));
fs.writeFileSync(path.join(tmp,"before.prisma"), fs.readFileSync(path.join(root,"prisma/schema.prisma"),"utf8").replace(/\nmodel SimulationWorkspace \{[^}]*\}/g,"\n").replace(/\nmodel SimulationEvent \{[^}]*\}/g,"\n").replace(/^  simulationWorkspace SimulationWorkspace\?\n/gm,""));
const ddl = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-empty", "--to-schema-datamodel", path.join(tmp,"before.prisma"), "--script"], {
  cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://127.0.0.1/disposable" },
});
if (ddl.status) throw Error(ddl.stderr);
const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 54351, maxConnections: 1 });
try {
  await db.exec(ddl.stdout);
  await db.exec(`INSERT INTO "User" (id,email,"passwordHash","displayName",role,"updatedAt") VALUES ('legacy-monitoring','legacy-monitoring@qa.invalid','unused','Histórica','COOPERATIVE',now()); INSERT INTO "Cooperative" (id,"userId",name,"updatedAt") VALUES ('legacy-monitoring-coop','legacy-monitoring','Cooperativa histórica',now());`);
  await db.exec(fs.readFileSync(path.join(root,"prisma/migrations/20261123020000_isolated_simulation/migration.sql"),"utf8"));
  const legacy=await db.query(`SELECT name FROM "Cooperative" WHERE id='legacy-monitoring-coop'`);
  if(legacy.rows[0]?.name!=="Cooperativa histórica")throw Error("Migração alterou cadastro existente.");
  console.log("PASS: migração cria tabelas de simulação sem modificar cooperativas existentes");
  await server.start();
  const child = spawn(process.execPath, ["--import", "tsx", "tests/simulation/integration.ts"], {
    cwd: root, stdio: "inherit", env: { ...process.env, DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54351/postgres?connection_limit=1", JWT_SECRET: "cooperative-intakes-disposable-local-secret", NODE_ENV: "test", APP_ENV: "local", LOG_LEVEL: "silent", KATUA_SIMULATION_TEST: "1" },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
} finally { await server.stop(); await db.close(); fs.rmSync(tmp,{recursive:true,force:true}); }
