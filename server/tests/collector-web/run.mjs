import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
if (!process.env.KATUA_VALIDATION_TOOLS)
  throw Error("Informe as ferramentas locais.");
const require = createRequire(
  path.resolve(process.env.KATUA_VALIDATION_TOOLS, "package.json"),
);
const { PGlite } = require("@electric-sql/pglite"),
  { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const root = path.resolve(
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
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://localhost/disposable" },
  },
);
if (ddl.status !== 0) throw Error(ddl.stderr);
const db = await PGlite.create();
let socket;
try {
  await db.exec(ddl.stdout);
  socket = new PGLiteSocketServer({ db, port: 54329, host: "127.0.0.1" });
  await socket.start();
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/collector-web/integration.ts"],
    {
      cwd: root,
      env: {
        ...process.env,
        KATUA_COLLECTOR_LOCAL: "1",
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        JWT_SECRET: "collector-local-test-only-secret-at-least32",
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1",
      },
      stdio: "inherit",
    },
  );
  process.exitCode =
    (await new Promise((resolve, reject) => {
      child.once("exit", resolve);
      child.once("error", reject);
    })) || 0;
} finally {
  await socket?.stop();
  await db.close();
}
