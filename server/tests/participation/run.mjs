// Disposable database only. No application environment file is loaded here.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
const require = createRequire(
  path.resolve(
    process.env.KATUA_VALIDATION_TOOLS || "../../../validation-tools",
    "package.json",
  ),
);
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
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
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://127.0.0.1/disposable" },
  },
);
if (ddl.status !== 0) throw Error(ddl.stderr);
const db = await PGlite.create();
const server = new PGLiteSocketServer({
  db,
  host: "127.0.0.1",
  port: 54339,
  maxConnections: 1,
});
try {
  await db.exec(ddl.stdout);
  await server.start();
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/participation/integration.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:54339/postgres?connection_limit=1",
        JWT_SECRET: "participation-local-test-secret-32-characters",
        NODE_ENV: "test",
        APP_ENV: "local",
        LOG_LEVEL: "silent",
        KATUA_PARTICIPATION_TEST: "1",
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
}
