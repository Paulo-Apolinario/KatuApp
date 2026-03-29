import { api } from "./api";
import type {
  Collection,
  CollectionMaterial,
  CollectionStatus,
} from "@/src/types/collection";

// mantém compatibilidade com arquivos que importam tipos do service
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
      (item): item is CollectionMaterial =>
        !!item && item.type.length > 0
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

async function list(): Promise<Collection[]> {
  const response = await api.get<ListCollectionsApiResponse>(
    "/collections",
    true
  );

  const collections = Array.isArray(response)
    ? response
    : Array.isArray(response?.collections)
    ? response.collections
    : [];

  return collections.map(normalizeCollection);
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

  return normalizeCollection(response.collection);
}

async function updateStatus(
  id: string,
  payload: UpdateCollectionStatusPayload
): Promise<Collection> {
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

  return normalizeCollection(response.collection);
}

export const collectionService = {
  list,
  create,
  updateStatus,
};

// compatibilidade total com import default
export default collectionService;