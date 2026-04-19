import { runQuery, runSingle } from "../index";
import { TABLES } from "../schema";

type SessionRecord = {
  id: number;
  token: string | null;
  user_id: string | null;
  payload_json: string | null;
  updated_at: string | null;
};

export async function saveSession(params: {
  token: string;
  userId?: string | null;
  payload?: unknown;
}) {
  await clearSession();

  const now = new Date().toISOString();

  await runQuery(
    `
    INSERT INTO ${TABLES.SESSION} (
      token,
      user_id,
      payload_json,
      updated_at
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      params.token,
      params.userId ?? null,
      params.payload ? JSON.stringify(params.payload) : null,
      now,
    ]
  );
}

export async function getSession() {
  const row = (await runSingle(
    `
    SELECT *
    FROM ${TABLES.SESSION}
    ORDER BY id DESC
    LIMIT 1
    `
  )) as SessionRecord | null;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    token: row.token,
    userId: row.user_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    updatedAt: row.updated_at,
  };
}

export async function clearSession() {
  await runQuery(`DELETE FROM ${TABLES.SESSION}`);
}