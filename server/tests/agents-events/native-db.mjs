import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
/** Disposable PostgreSQL 16 only: loopback fixed test port, private fresh data dir, never production credentials. */
export async function createNativeDatabase(bin, tmp) {
  if (!path.isAbsolute(bin) || !fs.existsSync(path.join(bin, "initdb")))
    throw Error("Diretório de binários PostgreSQL inválido.");
  const data = path.join(tmp, "native-data");
  fs.mkdirSync(data);
  fs.chmodSync(tmp, 0o755);
  const root = process.getuid?.() === 0;
  if (root) {
    fs.chownSync(data, 65534, 65534);
    fs.chmodSync(data, 0o700);
  }
  const native = (name, args) =>
    execFileSync(
      root ? "runuser" : path.join(bin, name),
      root ? ["-u", "nobody", "--", path.join(bin, name), ...args] : args,
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
  native("initdb", [
    "-D",
    data,
    "--username=postgres",
    "--auth=trust",
    "--encoding=UTF8",
    "--no-locale",
  ]);
  native("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(data, "server.log"),
    "-o",
    `-h 127.0.0.1 -p 54329 -F -c shared_buffers=64MB -c max_connections=12 -c jit=off -c statement_timeout=30000 -c unix_socket_directories=${data}`,
    "-w",
    "start",
  ]);
  const psql = (sql) =>
    execFileSync(
      path.join(bin, "psql"),
      [
        "-h",
        "127.0.0.1",
        "-p",
        "54329",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-qAt",
      ],
      { input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
  console.log("NATIVE_POSTGRES", psql("SELECT version()").trim());
  return {
    exec: async (sql) => {
      psql(sql);
    },
    query: async (sql) => ({
      rows: JSON.parse(
        psql(
          `SELECT coalesce(json_agg(r),'[]'::json) FROM (${sql.trim().replace(/;$/, "")}) r;`,
        ),
      ),
    }),
    close: async () => {
      native("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    },
  };
}
