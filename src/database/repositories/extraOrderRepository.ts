import { runQuery, runSingle } from "../index";
import { getSession } from "./sessionRepository";
export async function extraOwner() {
  const s = await getSession();
  return s?.userId || s?.payload?.id || null;
}
export async function saveExtraRecord(
  id: string,
  payload: unknown,
  status: string,
  expectedOwner?: string,
) {
  const owner = await extraOwner();
  if (!owner || (expectedOwner && owner !== expectedOwner))
    throw Error("A conta mudou. Reabra a ordem na conta correta.");
  await runQuery(
    `INSERT OR REPLACE INTO extra_orders_local (id,status,payload_json,updated_at) VALUES (?,?,?,?)`,
    [
      `${owner}:${id}`,
      status,
      JSON.stringify({ data: payload, __ownerId: owner }),
      new Date().toISOString(),
    ],
  );
}
function map(row: any, owner: string | null) {
  if (!row) return null;
  const p = JSON.parse(row.payload_json);
  return owner && p.__ownerId === owner ? p.data : null;
}
export async function getExtraRecord(id: string) {
  const owner = await extraOwner();
  return owner
    ? map(
        await runSingle(
          `SELECT * FROM extra_orders_local WHERE id = ? LIMIT 1`,
          [`${owner}:${id}`],
        ),
        owner,
      )
    : null;
}
export async function listExtraRecords() {
  const owner = await extraOwner();
  const rows = await runQuery(
    `SELECT * FROM extra_orders_local ORDER BY updated_at DESC`,
  );
  return rows.map((r: any) => map(r, owner)).filter(Boolean);
}
