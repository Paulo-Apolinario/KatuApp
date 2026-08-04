import { getDatabase } from "./index";
import { TABLES } from "./schema";

export async function runMigrations() {
  const db = await getDatabase();

  await db.execAsync(`
CREATE TABLE IF NOT EXISTS ${TABLES.APP_META} (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.SESSION} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT,
  user_id TEXT,
  payload_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
  id TEXT PRIMARY KEY,
  role TEXT,
  payload_json TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.ROUTES} (
  id TEXT PRIMARY KEY,
  status TEXT,
  driver_id TEXT,
  scheduled_date TEXT,
  payload_json TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.COLLECTIONS} (
  id TEXT PRIMARY KEY,
  status TEXT,
  route_id TEXT,
  driver_id TEXT,
  collector_id TEXT,
  total_weight_kg REAL,
  payload_json TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.SCHEDULES} (
  id TEXT PRIMARY KEY,
  status TEXT,
  generator_id TEXT,
  payload_json TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.GENERATORS} (
  id TEXT PRIMARY KEY,
  name TEXT,
  latitude REAL,
  longitude REAL,
  payload_json TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.COOPERATIVES} (
  id TEXT PRIMARY KEY,
  name TEXT,
  latitude REAL,
  longitude REAL,
  payload_json TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.DRIVERS} (
  id TEXT PRIMARY KEY,
  name TEXT,
  payload_json TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.VEHICLES} (
  id TEXT PRIMARY KEY,
  plate TEXT,
  payload_json TEXT,
  last_synced_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_QUEUE} (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routes_driver
ON routes_local(driver_id);

CREATE INDEX IF NOT EXISTS idx_collections_route
ON collections_local(route_id);

CREATE INDEX IF NOT EXISTS idx_collections_driver
ON collections_local(driver_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status
ON sync_queue(status);

CREATE INDEX IF NOT EXISTS idx_sync_queue_entity
ON sync_queue(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at
ON sync_queue(created_at);
`);

  console.log("SQLite migrations executadas.");
}