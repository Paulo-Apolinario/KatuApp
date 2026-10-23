/** Adaptador persistente para os repositórios offline usados no navegador.
 * Suporta somente as consultas parametrizadas desses repositórios. */
const tables = new Set([
  "session_local",
  "collections_local",
  "routes_local",
  "schedules_local",
  "sync_queue",
  "extra_orders_local",
]);
let writer: Promise<unknown> = Promise.resolve();
export async function getDatabase() {
  return null;
}
export async function execute(_sql: string) {
  /* DDL é gerenciado pelo SQLite nativo. */
}
export function runQuery(sql: string, params: any[] = []): Promise<any[]> {
  const operation = writer.then(() => {
    if (typeof localStorage === "undefined")
      throw new Error("Armazenamento local indisponível.");
    const normalized = sql.replace(/\s+/g, " ").trim();
    const table = /(?:FROM|INTO|UPDATE)\s+(\w+)/i
      .exec(normalized)?.[1]
      ?.toLowerCase();
    if (!table || !tables.has(table))
      throw new Error("Consulta offline não suportada.");
    const key = `@katu:offline:${table}`;
    let rows: any[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (/^INSERT/i.test(normalized)) {
      const cols = /\(([^)]+)\)/
        .exec(normalized)![1]
        .split(",")
        .map((c) => c.trim());
      const row: any = Object.fromEntries(cols.map((c, i) => [c, params[i]]));
      if (table === "session_local") row.id = Date.now();
      rows = [...rows.filter((r) => r.id !== row.id), row];
    } else if (/^UPDATE sync_queue/i.test(normalized)) {
      rows = rows.map((r) =>
        r.id === params[4]
          ? {
              ...r,
              status: params[0],
              retry_count: params[1],
              error_message: params[2],
              updated_at: params[3],
            }
          : r,
      );
    } else if (/^DELETE/i.test(normalized)) {
      rows = /WHERE id =/i.test(normalized)
        ? rows.filter((r) => r.id !== params[0])
        : /WHERE status =/i.test(normalized)
          ? rows.filter((r) => r.status !== params[0])
          : [];
    } else if (/^SELECT/i.test(normalized)) {
      const field = /WHERE (id|driver_id|route_id|generator_id) =/i.exec(
        normalized,
      )?.[1];
      if (field) rows = rows.filter((r) => r[field] === params[0]);
      if (/WHERE status IN/i.test(normalized))
        rows = rows.filter((r) => params.includes(r.status));
      if (/ORDER BY created_at ASC/i.test(normalized))
        rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
      else
        rows.sort((a, b) =>
          String(b.updated_at || b.id).localeCompare(
            String(a.updated_at || a.id),
          ),
        );
      return /LIMIT 1/i.test(normalized) ? rows.slice(0, 1) : rows;
    } else throw new Error("Consulta offline não suportada.");
    localStorage.setItem(key, JSON.stringify(rows));
    return [];
  });
  writer = operation.catch(() => {});
  return operation;
}
export async function runSingle(sql: string, params: any[] = []) {
  return (await runQuery(sql, params))[0] || null;
}
