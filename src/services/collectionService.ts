import { api, isApiNetworkError } from "./api";
import {
  getAllCollections,
  getCollectionById,
  getCollectionsByDriver as getCollectionsByDriverFromCache,
  getCollectionsByRoute as getCollectionsByRouteFromCache,
  upsertCollections,
} from "../database/repositories/collectionRepository";
import {
  enqueueSyncItem,
} from "../database/repositories/syncQueueRepository";
import { SYNC_ENTITY, SYNC_OPERATION } from "../database/schema";
import type {
  Collection,
  CollectionMaterial,
  CollectionStatus,
} from "@/src/types/collection";

export type {
  Collection,
  CollectionMaterial,
  CollectionStatus,
} from "@/src/types/collection";

export interface CreateCollectionPayload {
  scheduleId: string;
  collectorId: string;
  driverId?: string;
  vehicleId?: string;
  routeId?: string;
  collectedAt?: string;
  totalWeightKg?: number;
  materials?: CollectionMaterial[];
  notes?: string;
}

export interface UpdateCollectionStatusPayload {
  status: CollectionStatus;
  collectedAt?: string;
  totalWeightKg?: number;
  materials?: CollectionMaterial[];
  notes?: string;
}

type ListCollectionsApiResponse =
  | Collection[]
  | {
      collections?: Collection[];
      success?: boolean;
    };

type CreateCollectionApiResponse = {
  collection?: Collection;
  success?: boolean;
};

type UpdateCollectionStatusApiResponse = {
  collection?: Collection;
  success?: boolean;
};

export function translateCollectionStatus(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluída";
    case "CANCELLED":
      return "Cancelada";
    default:
      return "Não informado";
  }
}

function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (typeof item === "string") {
        return {
          type: item.trim(),
          quantityKg: 0,
        };
      }

      if (item && typeof item === "object") {
        const typedItem = item as {
          type?: unknown;
          quantityKg?: unknown;
        };

        return {
          type: String(typedItem.type ?? "").trim(),
          quantityKg: Number(typedItem.quantityKg ?? 0),
        };
      }

      return null;
    })
    .filter(
      (item): item is CollectionMaterial => !!item && item.type.length > 0
    );
}

function normalizeCollection(collection: Collection): Collection {
  return {
    ...collection,
    totalWeightKg: Number(collection.totalWeightKg ?? 0),
    materials: normalizeMaterials(collection.materials),

    generator: collection.generator
      ? {
          ...collection.generator,
          latitude:
            typeof collection.generator.latitude === "number"
              ? collection.generator.latitude
              : collection.generator.latitude != null
              ? Number(collection.generator.latitude)
              : null,
          longitude:
            typeof collection.generator.longitude === "number"
              ? collection.generator.longitude
              : collection.generator.longitude != null
              ? Number(collection.generator.longitude)
              : null,
        }
      : null,

    schedule: collection.schedule
      ? {
          ...collection.schedule,
          generator: collection.schedule.generator
            ? {
                ...collection.schedule.generator,
                latitude:
                  typeof collection.schedule.generator.latitude === "number"
                    ? collection.schedule.generator.latitude
                    : collection.schedule.generator.latitude != null
                    ? Number(collection.schedule.generator.latitude)
                    : null,
                longitude:
                  typeof collection.schedule.generator.longitude === "number"
                    ? collection.schedule.generator.longitude
                    : collection.schedule.generator.longitude != null
                    ? Number(collection.schedule.generator.longitude)
                    : null,
              }
            : null,
        }
      : null,
  };
}

function serializeMaterials(
  materials?: CollectionMaterial[]
): CollectionMaterial[] | undefined {
  if (!Array.isArray(materials) || materials.length === 0) {
    return undefined;
  }

  const normalized = materials
    .map((item) => ({
      type: String(item.type ?? "").trim(),
      quantityKg: Number(item.quantityKg ?? 0),
    }))
    .filter((item) => item.type.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function createSyncQueueId(prefix: string, entityId: string) {
  return `${prefix}_${entityId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

async function saveCollectionsToCache(collections: Collection[]) {
  await upsertCollections(
    collections.map((collection) => ({
      id: collection.id,
      status: collection.status,
      routeId: collection.routeId ?? collection.route?.id ?? null,
      driverId: collection.driverId ?? collection.route?.driverId ?? null,
      collectorId: collection.collectorId ?? collection.collector?.id ?? null,
      totalWeightKg: Number(collection.totalWeightKg ?? 0),
      payload: collection,
      updatedAt: collection.updatedAt ?? null,
    }))
  );
}

async function readCollectionsFromCache(): Promise<Collection[]> {
  const rows = await getAllCollections();

  return rows
    .map((row) => row?.payload)
    .filter((item): item is Collection => !!item)
    .map(normalizeCollection);
}

async function readCollectionByIdFromCache(
  id: string
): Promise<Collection | null> {
  const row = await getCollectionById(id);

  if (!row?.payload) return null;

  return normalizeCollection(row.payload as Collection);
}

async function saveCollectionStatusOffline(
  id: string,
  payload: UpdateCollectionStatusPayload
): Promise<Collection> {
  const existing = await readCollectionByIdFromCache(id);

  if (!existing) {
    throw new Error(
      "Coleta não encontrada no cache local para atualização offline."
    );
  }

  const updatedCollection: Collection = normalizeCollection({
    ...existing,
    status: payload.status,
    collectedAt:
      payload.collectedAt !== undefined
        ? payload.collectedAt
        : existing.collectedAt ?? null,
    totalWeightKg:
      typeof payload.totalWeightKg === "number"
        ? Number(payload.totalWeightKg)
        : Number(existing.totalWeightKg ?? 0),
    materials:
      payload.materials !== undefined
        ? normalizeMaterials(payload.materials)
        : normalizeMaterials(existing.materials),
    notes:
      payload.notes !== undefined
        ? payload.notes?.trim() || null
        : existing.notes ?? null,
    updatedAt: new Date().toISOString(),
  });

  await saveCollectionsToCache([updatedCollection]);

  const operationType =
    payload.status === "COMPLETED"
      ? SYNC_OPERATION.COMPLETE_COLLECTION
      : SYNC_OPERATION.UPDATE_COLLECTION_STATUS;

  await enqueueSyncItem({
    id: createSyncQueueId("collection_status", id),
    operationType,
    entityType: SYNC_ENTITY.COLLECTION,
    entityId: id,
    payload: {
      id,
      status: payload.status,
      collectedAt: payload.collectedAt || undefined,
      totalWeightKg:
        typeof payload.totalWeightKg === "number"
          ? payload.totalWeightKg
          : undefined,
      materials: serializeMaterials(payload.materials),
      notes: payload.notes?.trim() || undefined,
    },
  });

  return updatedCollection;
}

async function list(): Promise<Collection[]> {
  try {
    const response = await api.get<ListCollectionsApiResponse>(
      "/collections",
      true
    );

    const collections = Array.isArray(response)
      ? response
      : Array.isArray(response?.collections)
      ? response.collections
      : [];

    const normalized = collections.map(normalizeCollection);
    await saveCollectionsToCache(normalized);

    return normalized;
  } catch (error) {
    if (isApiNetworkError(error)) {
      return readCollectionsFromCache();
    }

    throw error;
  }
}

async function listByDriver(driverId?: string | null): Promise<Collection[]> {
  if (!driverId) {
    return list();
  }

  try {
    const collections = await list();

    const filtered = collections.filter((collection) => {
      const directMatch = collection.driverId === driverId;
      const routeMatch = collection.route?.driverId === driverId;

      return directMatch || routeMatch;
    });

    return filtered.length > 0 ? filtered : collections;
  } catch (error) {
    if (isApiNetworkError(error)) {
      const rows = await getCollectionsByDriverFromCache(driverId);

      return rows
        .map((row) => row?.payload)
        .filter((item): item is Collection => !!item)
        .map(normalizeCollection);
    }

    throw error;
  }
}

async function listByRoute(routeId?: string | null): Promise<Collection[]> {
  if (!routeId) return list();

  try {
    const collections = await list();
    return collections.filter((collection) => collection.routeId === routeId);
  } catch (error) {
    if (isApiNetworkError(error)) {
      const rows = await getCollectionsByRouteFromCache(routeId);

      return rows
        .map((row) => row?.payload)
        .filter((item): item is Collection => !!item)
        .map(normalizeCollection);
    }

    throw error;
  }
}

async function listActiveByDriver(
  driverId?: string | null
): Promise<Collection[]> {
  const collections = await listByDriver(driverId);

  return collections.filter(
    (collection) =>
      collection.status === "PENDING" || collection.status === "IN_PROGRESS"
  );
}

async function getById(id: string): Promise<Collection> {
  try {
    const collections = await list();
    const found = collections.find((item) => item.id === id);

    if (found) return found;

    throw new Error("Coleta não encontrada.");
  } catch (error) {
    if (isApiNetworkError(error)) {
      const cached = await readCollectionByIdFromCache(id);

      if (cached) return cached;
    }

    throw error;
  }
}

async function create(payload: CreateCollectionPayload): Promise<Collection> {
  const response = await api.post<CreateCollectionApiResponse>(
    "/collections",
    {
      scheduleId: payload.scheduleId,
      collectorId: payload.collectorId,
      driverId: payload.driverId || undefined,
      vehicleId: payload.vehicleId || undefined,
      routeId: payload.routeId || undefined,
      collectedAt: payload.collectedAt || undefined,
      totalWeightKg:
        typeof payload.totalWeightKg === "number"
          ? payload.totalWeightKg
          : undefined,
      materials: serializeMaterials(payload.materials),
      notes: payload.notes?.trim() || undefined,
    },
    true
  );

  if (!response?.collection) {
    throw new Error("Coleta não retornada pela API.");
  }

  const normalized = normalizeCollection(response.collection);
  await saveCollectionsToCache([normalized]);

  return normalized;
}

async function updateStatus(
  id: string,
  payload: UpdateCollectionStatusPayload
): Promise<Collection> {
  try {
    const response = await api.patch<UpdateCollectionStatusApiResponse>(
      `/collections/${id}/status`,
      {
        status: payload.status,
        collectedAt: payload.collectedAt || undefined,
        totalWeightKg:
          typeof payload.totalWeightKg === "number"
            ? payload.totalWeightKg
            : undefined,
        materials: serializeMaterials(payload.materials),
        notes: payload.notes?.trim() || undefined,
      },
      true
    );

    if (!response?.collection) {
      throw new Error("Coleta não retornada pela API.");
    }

    const normalized = normalizeCollection(response.collection);
    await saveCollectionsToCache([normalized]);

    return normalized;
  } catch (error) {
    if (isApiNetworkError(error)) {
      return saveCollectionStatusOffline(id, payload);
    }

    throw error;
  }
}

export const collectionService = {
  list,
  listByDriver,
  listByRoute,
  listActiveByDriver,
  getById,
  create,
  updateStatus,
};

export default collectionService;