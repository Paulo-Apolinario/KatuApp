import { runQuery, runSingle } from "../index";
import { SYNC_STATUS, TABLES } from "../schema";

export type SyncQueueStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "ERROR";

export type SyncQueueOperation =
  | "UPDATE_COLLECTION_STATUS"
  | "COMPLETE_COLLECTION"
  | "UPDATE_ROUTE_STATUS"
  | "UPDATE_ROUTE_PROGRESS";

export type SyncQueueEntity = "COLLECTION" | "ROUTE";

type SyncQueueRow = {
  id: string;
  operation_type: SyncQueueOperation;
  entity_type: SyncQueueEntity;
  entity_id: string;
  payload_json: string;
  status: SyncQueueStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type EnqueueSyncItemInput = {
  id: string;
  operationType: SyncQueueOperation;
  entityType: SyncQueueEntity;
  entityId: string;
  payload: unknown;
  status?: SyncQueueStatus;
};

function mapRow(row: SyncQueueRow | null) {
  if (!row) return null;

  return {
    id: row.id,
    operationType: row.operation_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    status: row.status,
    retryCount: Number(row.retry_count ?? 0),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function enqueueSyncItem(input: EnqueueSyncItemInput) {
  const now = new Date().toISOString();

  await runQuery(
    `
    INSERT OR REPLACE INTO ${TABLES.SYNC_QUEUE} (
      id,
      operation_type,
      entity_type,
      entity_id,
      payload_json,
      status,
      retry_count,
      error_message,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.operationType,
      input.entityType,
      input.entityId,
      JSON.stringify(input.payload),
      input.status ?? SYNC_STATUS.PENDING,
      0,
      null,
      now,
      now,
    ]
  );
}

export async function getPendingSyncItems() {
  const rows = (await runQuery(
    `
    SELECT *
    FROM ${TABLES.SYNC_QUEUE}
    WHERE status IN (?, ?)
    ORDER BY created_at ASC
    `,
    [SYNC_STATUS.PENDING, SYNC_STATUS.ERROR]
  )) as SyncQueueRow[];

  return rows.map((row) => mapRow(row)).filter(Boolean);
}

export async function getSyncItemById(id: string) {
  const row = (await runSingle(
    `
    SELECT *
    FROM ${TABLES.SYNC_QUEUE}
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  )) as SyncQueueRow | null;

  return mapRow(row);
}

export async function updateSyncItemStatus(
  id: string,
  status: SyncQueueStatus,
  options?: {
    retryCount?: number;
    errorMessage?: string | null;
  }
) {
  const current = await getSyncItemById(id);
  const now = new Date().toISOString();

  await runQuery(
    `
    UPDATE ${TABLES.SYNC_QUEUE}
    SET status = ?,
        retry_count = ?,
        error_message = ?,
        updated_at = ?
    WHERE id = ?
    `,
    [
      status,
      options?.retryCount ?? current?.retryCount ?? 0,
      options?.errorMessage ?? null,
      now,
      id,
    ]
  );
}

export async function markSyncItemSyncing(id: string) {
  const current = await getSyncItemById(id);

  await updateSyncItemStatus(id, SYNC_STATUS.SYNCING, {
    retryCount: current ? current.retryCount : 0,
    errorMessage: null,
  });
}

export async function markSyncItemSynced(id: string) {
  await updateSyncItemStatus(id, SYNC_STATUS.SYNCED, {
    errorMessage: null,
  });
}

export async function markSyncItemError(id: string, errorMessage: string) {
  const current = await getSyncItemById(id);

  await updateSyncItemStatus(id, SYNC_STATUS.ERROR, {
    retryCount: current ? current.retryCount + 1 : 1,
    errorMessage,
  });
}

export async function clearSyncedSyncItems() {
  await runQuery(
    `
    DELETE FROM ${TABLES.SYNC_QUEUE}
    WHERE status = ?
    `,
    [SYNC_STATUS.SYNCED]
  );
}