import { getSession } from "./sessionRepository";
import { runQuery, runSingle } from "../index";
import { TABLES } from "../schema";

type ScheduleRow = {
  id: string;
  status: string | null;
  generator_id: string | null;
  payload_json: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
};

type ScheduleUpsertInput = {
  id: string;
  status?: string | null;
  generatorId?: string | null;
  payload: unknown;
  updatedAt?: string | null;
};

function mapScheduleRow(row: ScheduleRow | null) {
  if (!row) return null;

  return {
    id: row.payload_json ? JSON.parse(row.payload_json).id || row.id : row.id,
    status: row.status,
    generatorId: row.generator_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertSchedules(schedules: ScheduleUpsertInput[]) {
  const session = await getSession();
  const ownerId = session?.userId || session?.payload?.id;
  if (!ownerId) throw new Error("Sessão necessária para salvar agendamentos.");
  const now = new Date().toISOString();

  for (const schedule of schedules) {
    await runQuery(
      `
      INSERT OR REPLACE INTO ${TABLES.SCHEDULES} (
        id,
        status,
        generator_id,
        payload_json,
        last_synced_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        `${ownerId}:${schedule.id}`,
        schedule.status ?? null,
        schedule.generatorId ?? null,
        JSON.stringify({
          ...(schedule.payload as object),
          __cacheOwner: ownerId,
        }),
        now,
        schedule.updatedAt ?? now,
      ],
    );
  }
}

export async function getAllSchedules() {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.SCHEDULES}
    ORDER BY updated_at DESC
    `,
  )) as ScheduleRow[];

  const session = await getSession();
  const ownerId = session?.userId || session?.payload?.id;
  return rows
    .map(mapScheduleRow)
    .filter((row) => ownerId && row?.payload?.__cacheOwner === ownerId);
}

export async function getScheduleById(id: string) {
  const session = await getSession();
  const ownerId = session?.userId || session?.payload?.id;
  if (!ownerId) return null;
  const row = (await runSingle(
    `
    SELECT *
    FROM ${TABLES.SCHEDULES}
    WHERE id = ?
    LIMIT 1
    `,
    [`${ownerId}:${id}`],
  )) as ScheduleRow | null;

  const mapped = mapScheduleRow(row);
  return mapped?.payload?.__cacheOwner === ownerId ? mapped : null;
}

export async function clearSchedules() {
  await runQuery(`DELETE FROM ${TABLES.SCHEDULES}`);
}
