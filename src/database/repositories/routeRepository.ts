import { runQuery, runSingle } from "../index";
import { TABLES } from "../schema";

type RouteRow = {
  id: string;
  status: string | null;
  driver_id: string | null;
  scheduled_date: string | null;
  payload_json: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
};

type RouteUpsertInput = {
  id: string;
  status?: string | null;
  driverId?: string | null;
  scheduledDate?: string | null;
  payload: unknown;
  updatedAt?: string | null;
};

function mapRouteRow(row: RouteRow | null) {
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    driverId: row.driver_id,
    scheduledDate: row.scheduled_date,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertRoutes(routes: RouteUpsertInput[]) {
  const now = new Date().toISOString();

  for (const route of routes) {
    await runQuery(
      `
      INSERT OR REPLACE INTO ${TABLES.ROUTES} (
        id,
        status,
        driver_id,
        scheduled_date,
        payload_json,
        last_synced_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        route.id,
        route.status ?? null,
        route.driverId ?? null,
        route.scheduledDate ?? null,
        JSON.stringify(route.payload),
        now,
        route.updatedAt ?? now,
      ]
    );
  }
}

export async function getAllRoutes() {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.ROUTES}
    ORDER BY updated_at DESC
    `
  )) as RouteRow[];

  return rows.map((row) => mapRouteRow(row));
}

export async function getRouteById(id: string) {
  const row = (await runSingle(
    `
    SELECT *
    FROM ${TABLES.ROUTES}
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  )) as RouteRow | null;

  return mapRouteRow(row);
}

export async function getRoutesByDriver(driverId: string) {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.ROUTES}
    WHERE driver_id = ?
    ORDER BY updated_at DESC
    `,
    [driverId]
  )) as RouteRow[];

  return rows.map((row) => mapRouteRow(row));
}

export async function clearRoutes() {
  await runQuery(`DELETE FROM ${TABLES.ROUTES}`);
}