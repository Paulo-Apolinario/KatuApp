import { api } from "@/src/services/api";
import {
  clearSyncedSyncItems,
  getPendingSyncItems,
  markSyncItemError,
  markSyncItemSynced,
  markSyncItemSyncing,
  type SyncQueueEntity,
  type SyncQueueOperation,
} from "@/src/database/repositories/syncQueueRepository";
import { upsertCollections } from "@/src/database/repositories/collectionRepository";
import { upsertRoutes } from "@/src/database/repositories/routeRepository";
import { getCurrentConnectivity } from "./connectivity";

type SyncCollectionMaterial = {
  type: string;
  quantityKg: number;
};

type SyncCollectionPayload = {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  collectedAt?: string;
  totalWeightKg?: number;
  materials?: SyncCollectionMaterial[];
  notes?: string;
};

type SyncRoutePayload = {
  id: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
};

type PendingSyncItem = {
  id: string;
  operationType: SyncQueueOperation;
  entityType: SyncQueueEntity;
  entityId: string;
  payload: unknown;
  status: "PENDING" | "SYNCING" | "SYNCED" | "ERROR";
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type UpdateCollectionStatusApiResponse = {
  collection?: any;
  success?: boolean;
};

type UpdateRouteStatusApiResponse = {
  route?: any;
  success?: boolean;
};

function isCollectionOperation(operationType: SyncQueueOperation) {
  return (
    operationType === "UPDATE_COLLECTION_STATUS" ||
    operationType === "COMPLETE_COLLECTION"
  );
}

function isRouteOperation(operationType: SyncQueueOperation) {
  return (
    operationType === "UPDATE_ROUTE_STATUS" ||
    operationType === "UPDATE_ROUTE_PROGRESS"
  );
}

function ensureEntity(
  entityType: SyncQueueEntity,
  expected: SyncQueueEntity,
  operationType: SyncQueueOperation
) {
  if (entityType !== expected) {
    throw new Error(
      `Entidade inválida para ${operationType}. Esperado ${expected}, recebido ${entityType}.`
    );
  }
}

async function syncCollectionStatus(payload: SyncCollectionPayload) {
  const response = await api.patch<UpdateCollectionStatusApiResponse>(
    `/collections/${payload.id}/status`,
    {
      status: payload.status,
      collectedAt: payload.collectedAt || undefined,
      totalWeightKg:
        typeof payload.totalWeightKg === "number"
          ? payload.totalWeightKg
          : undefined,
      materials:
        Array.isArray(payload.materials) && payload.materials.length > 0
          ? payload.materials
          : undefined,
      notes: payload.notes?.trim() || undefined,
    },
    true
  );

  if (!response?.collection) {
    throw new Error("Coleta não retornada pela API durante sincronização.");
  }

  const collection = response.collection;

  await upsertCollections([
    {
      id: collection.id,
      status: collection.status ?? null,
      routeId: collection.routeId ?? collection.route?.id ?? null,
      driverId: collection.driverId ?? collection.route?.driverId ?? null,
      collectorId: collection.collectorId ?? collection.collector?.id ?? null,
      totalWeightKg: Number(collection.totalWeightKg ?? 0),
      payload: collection,
      updatedAt: collection.updatedAt ?? new Date().toISOString(),
    },
  ]);
}

async function syncRouteStatus(payload: SyncRoutePayload) {
  const response = await api.patch<UpdateRouteStatusApiResponse>(
    `/routes/${payload.id}/status`,
    {
      status: payload.status,
    },
    true
  );

  if (!response?.route) {
    throw new Error("Rota não retornada pela API durante sincronização.");
  }

  const route = response.route;

  await upsertRoutes([
    {
      id: route.id,
      status: route.status ?? null,
      driverId: route.driverId ?? null,
      scheduledDate: route.scheduledDate ?? null,
      payload: route,
      updatedAt: route.updatedAt ?? new Date().toISOString(),
    },
  ]);
}

async function processSyncItem(item: PendingSyncItem) {
  await markSyncItemSyncing(item.id);

  try {
    if (isCollectionOperation(item.operationType)) {
      ensureEntity(item.entityType, "COLLECTION", item.operationType);
      await syncCollectionStatus(item.payload as SyncCollectionPayload);
    } else if (isRouteOperation(item.operationType)) {
      ensureEntity(item.entityType, "ROUTE", item.operationType);
      await syncRouteStatus(item.payload as SyncRoutePayload);
    } else {
      throw new Error(`Operação não suportada: ${item.operationType}`);
    }

    await markSyncItemSynced(item.id);
  } catch (error: any) {
    await markSyncItemError(
      item.id,
      error?.message || "Erro desconhecido na sincronização."
    );
  }
}

export async function syncPendingOperations() {
  const connectivity = await getCurrentConnectivity();

  if (connectivity.isOffline) {
    return {
      success: false,
      message: "Dispositivo offline. Sincronização não iniciada.",
      processed: 0,
    };
  }

  const pendingItems = (await getPendingSyncItems()) as PendingSyncItem[];

  if (!pendingItems.length) {
    return {
      success: true,
      message: "Nenhuma pendência para sincronizar.",
      processed: 0,
    };
  }

  for (const item of pendingItems) {
    await processSyncItem(item);
  }

  await clearSyncedSyncItems();

  return {
    success: true,
    message: "Sincronização concluída.",
    processed: pendingItems.length,
  };
}

export const syncEngine = {
  syncPendingOperations,
};

export default syncEngine;