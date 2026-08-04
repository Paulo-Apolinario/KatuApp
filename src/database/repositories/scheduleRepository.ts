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
    id: row.id,
    status: row.status,
    generatorId: row.generator_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertSchedules(schedules: ScheduleUpsertInput[]) {
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
        schedule.id,
        schedule.status ?? null,
        schedule.generatorId ?? null,
        JSON.stringify(schedule.payload),
        now,
        schedule.updatedAt ?? now,
      ]
    );
  }
}

export async function getAllSchedules() {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.SCHEDULES}
    ORDER BY updated_at DESC
    `
  )) as ScheduleRow[];

  return rows.map((row) => mapScheduleRow(row));
}

export async function getScheduleById(id: string) {
  const row = (await runSingle(
    `
    SELECT *
    FROM ${TABLES.SCHEDULES}
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  )) as ScheduleRow | null;

  return mapScheduleRow(row);
}

export async function clearSchedules() {
  await runQuery(`DELETE FROM ${TABLES.SCHEDULES}`);
}