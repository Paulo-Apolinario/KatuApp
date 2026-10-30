/** Servidor de validação local de um export Expo. Sem acesso à VPS. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
if (
  process.env.KATUA_LOCAL_VALIDATION !== "1" ||
  !process.env.KATUA_APP_WEB_EXPORT
)
  throw Error("Export local explícito obrigatório");
const root = resolve(process.env.KATUA_APP_WEB_EXPORT);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".json": "application/json",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    const base = resolve(root, "." + pathname);
    if (base !== root && !base.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let chosen;
    for (const p of [base, base + ".html", resolve(base, "index.html")]) {
      try {
        if ((await stat(p)).isFile()) {
          chosen = p;
          break;
        }
      } catch {}
    }
    if (!chosen) {
      res.writeHead(404).end();
      return;
    }
    res
      .writeHead(200, {
        "Content-Type": mime[extname(chosen)] || "application/octet-stream",
        "Cache-Control": "no-store",
      })
      .end(await readFile(chosen));
  } catch {
    res.writeHead(500).end();
  }
});
server.listen(5181, "127.0.0.1", () => console.log("LOCAL_APP_WEB_READY"));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
