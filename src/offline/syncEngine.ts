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
  operationType: SyncQueueOperation,
) {
  if (entityType !== expected) {
    throw new Error(
      `Entidade inválida para ${operationType}. Esperado ${expected}, recebido ${entityType}.`,
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
    true,
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
    true,
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
      payload: { ...route, syncStatus: "SYNCED" },
      updatedAt: route.updatedAt ?? new Date().toISOString(),
    },
  ]);
}

async function syncFieldAction(
  payload: { id: string; action: "start" | "complete-field"; body: unknown },
  currentId: string,
) {
  if (!["start", "complete-field"].includes(payload.action))
    throw new Error("Etapa de campo inválida.");
  const response = await api.post<UpdateCollectionStatusApiResponse>(
    `/collections/${payload.id}/${payload.action}`,
    payload.body,
    true,
  );
  if (!response?.collection)
    throw new Error("Coleta não retornada durante sincronização.");
  let collection = response.collection;
  const queued = await getPendingSyncItems();
  for (const item of queued) {
    if (
      item?.id === currentId ||
      item?.entityId !== collection.id ||
      item?.operationType !== "COLLECTION_FIELD_ACTION"
    )
      continue;
    collection = {
      ...collection,
      ...item.payload.body,
      ...(item.payload.localMaterials ? { materials: item.payload.localMaterials } : {}),
      status: item.payload.action === "start" ? "IN_PROGRESS" : "COLLECTED",
      syncStatus: "PENDING",
    };
  }
  await upsertCollections([
    {
      id: collection.id,
      status: collection.status,
      routeId: collection.routeId,
      driverId: collection.driverId,
      collectorId: collection.collectorId,
      totalWeightKg: Number(collection.totalWeightKg || 0),
      payload: { ...collection, syncStatus: collection.syncStatus || "SYNCED" },
      updatedAt: collection.updatedAt,
    },
  ]);
}

async function processSyncItem(item: PendingSyncItem) {
  if (!(await getPendingSyncItems()).some((pending) => pending?.id === item.id))
    return false;
  await markSyncItemSyncing(item.id);

  try {
    if (item.operationType === "COLLECTION_FIELD_ACTION") {
      ensureEntity(item.entityType, "COLLECTION", item.operationType);
      await syncFieldAction(item.payload as any, item.id);
    } else if (isCollectionOperation(item.operationType)) {
      ensureEntity(item.entityType, "COLLECTION", item.operationType);
      await syncCollectionStatus(item.payload as SyncCollectionPayload);
    } else if (isRouteOperation(item.operationType)) {
      ensureEntity(item.entityType, "ROUTE", item.operationType);
      await syncRouteStatus(item.payload as SyncRoutePayload);
    } else {
      throw new Error(`Operação não suportada: ${item.operationType}`);
    }

    await markSyncItemSynced(item.id);
    return true;
  } catch (error: any) {
    await markSyncItemError(
      item.id,
      error?.message || "Erro desconhecido na sincronização.",
    );
    return false;
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

  let synced = 0;
  let failed = 0;
  const blockedEntities = new Set<string>();
  for (const item of pendingItems) {
    // Nunca confirmar a conclusão antes de sincronizar o início da mesma coleta.
    if (blockedEntities.has(item.entityId)) {
      failed += 1;
      continue;
    }
    if (await processSyncItem(item)) synced += 1;
    else {
      failed += 1;
      blockedEntities.add(item.entityId);
    }
  }

  await clearSyncedSyncItems();

  return {
    success: failed === 0,
    message:
      failed > 0
        ? `${synced} operação(ões) sincronizada(s); ${failed} com erro. As operações com erro permanecem na fila para revisão ou nova tentativa.`
        : "Sincronização concluída.",
    processed: pendingItems.length,
    synced,
    failed,
  };
}

export const syncEngine = {
  syncPendingOperations,
};

export default syncEngine;
