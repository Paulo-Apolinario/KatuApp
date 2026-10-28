import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
const toolsRoot = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsRoot)
  throw Error(
    "Informe KATUA_VALIDATION_TOOLS com as dependências de teste descartáveis.",
  );
const require = createRequire(path.resolve(toolsRoot, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const ddl = spawnSync(
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
if (ddl.status !== 0) throw Error(ddl.stderr);
const db = await PGlite.create();
await db.exec(ddl.stdout);
const server = new PGLiteSocketServer({ db, port: 54329, host: "127.0.0.1" });
await server.start();
try {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/app-route-calendar/integration.ts"],
    {
      cwd: serverRoot,
      env: {
        ...process.env,
        KATUA_LOCAL_VALIDATION: "1",
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1",
      },
      stdio: "inherit",
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.on("exit", resolve);
    child.on("error", reject);
  });
} finally {
  await server.stop();
  await db.close();
}
