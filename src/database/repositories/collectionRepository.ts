import { runQuery, runSingle } from "../index";
import { TABLES } from "../schema";

type CollectionRow = {
  id: string;
  status: string | null;
  route_id: string | null;
  driver_id: string | null;
  collector_id: string | null;
  total_weight_kg: number | null;
  payload_json: string | null;
  last_synced_at: string | null;
  updated_at: string | null;
};

type CollectionUpsertInput = {
  id: string;
  status?: string | null;
  routeId?: string | null;
  driverId?: string | null;
  collectorId?: string | null;
  totalWeightKg?: number | null;
  payload: unknown;
  updatedAt?: string | null;
};

function mapCollectionRow(row: CollectionRow | null) {
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    routeId: row.route_id,
    driverId: row.driver_id,
    collectorId: row.collector_id,
    totalWeightKg: Number(row.total_weight_kg ?? 0),
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertCollections(collections: CollectionUpsertInput[]) {
  const now = new Date().toISOString();

  for (const collection of collections) {
    await runQuery(
      `
      INSERT OR REPLACE INTO ${TABLES.COLLECTIONS} (
        id,
        status,
        route_id,
        driver_id,
        collector_id,
        total_weight_kg,
        payload_json,
        last_synced_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        collection.id,
        collection.status ?? null,
        collection.routeId ?? null,
        collection.driverId ?? null,
        collection.collectorId ?? null,
        collection.totalWeightKg ?? 0,
        JSON.stringify(collection.payload),
        now,
        collection.updatedAt ?? now,
      ]
    );
  }
}

export async function getAllCollections() {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.COLLECTIONS}
    ORDER BY updated_at DESC
    `
  )) as CollectionRow[];

  return rows.map((row) => mapCollectionRow(row));
}

export async function getCollectionById(id: string) {
  const row = (await runSingle(
    `
    SELECT *
    FROM ${TABLES.COLLECTIONS}
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  )) as CollectionRow | null;

  return mapCollectionRow(row);
}

export async function getCollectionsByDriver(driverId: string) {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.COLLECTIONS}
    WHERE driver_id = ?
    ORDER BY updated_at DESC
    `,
    [driverId]
  )) as CollectionRow[];

  return rows.map((row) => mapCollectionRow(row));
}

export async function getCollectionsByRoute(routeId: string) {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.COLLECTIONS}
    WHERE route_id = ?
    ORDER BY updated_at DESC
    `,
    [routeId]
  )) as CollectionRow[];

  return rows.map((row) => mapCollectionRow(row));
}

export async function clearCollections() {
  await runQuery(`DELETE FROM ${TABLES.COLLECTIONS}`);
}