export const DB_NAME = "katu_offline.db";
export const DB_VERSION = 2;

export const TABLES = {
  APP_META: "app_meta",
  SESSION: "session_local",
  USERS: "users_local",
  ROUTES: "routes_local",
  COLLECTIONS: "collections_local",
  SCHEDULES: "schedules_local",
  GENERATORS: "generators_local",
  COOPERATIVES: "cooperatives_local",
  DRIVERS: "drivers_local",
  VEHICLES: "vehicles_local",
  SYNC_QUEUE: "sync_queue",
} as const;

export const SYNC_STATUS = {
  PENDING: "PENDING",
  SYNCING: "SYNCING",
  SYNCED: "SYNCED",
  ERROR: "ERROR",
} as const;

export const SYNC_OPERATION = {
  UPDATE_COLLECTION_STATUS: "UPDATE_COLLECTION_STATUS",
  COMPLETE_COLLECTION: "COMPLETE_COLLECTION",
  UPDATE_ROUTE_STATUS: "UPDATE_ROUTE_STATUS",
  UPDATE_ROUTE_PROGRESS: "UPDATE_ROUTE_PROGRESS",
} as const;

export const SYNC_ENTITY = {
  COLLECTION: "COLLECTION",
  ROUTE: "ROUTE",
} as const;