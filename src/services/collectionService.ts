import { api } from "./api";

export type CollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface CollectionMaterial {
  type: string;
  quantityKg: number;
}

export interface Collection {
  id: string;
  cooperativeId: string;
  generatorId?: string | null;
  collectorId?: string | null;
  scheduleId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
  collectedAt?: string | null;
  totalWeightKg: number;
  materials: CollectionMaterial[];
  notes?: string | null;
  status: CollectionStatus;
  createdAt?: string;
  updatedAt?: string;

  generator?: {
    id: string;
    name?: string | null;
    companyName?: string | null;
    address?: string | null;
  } | null;

  collector?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;

  driver?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    cnh?: string | null;
    cnhCategory?: string | null;
    status?: string | null;
  } | null;

  vehicle?: {
    id: string;
    plate?: string | null;
    model?: string | null;
    brand?: string | null;
    year?: number | null;
    capacityKg?: number | null;
    status?: string | null;
  } | null;

  route?: {
    id: string;
    name?: string | null;
    description?: string | null;
    scheduledDate?: string | null;
    stops?: string[];
    status?: string | null;
  } | null;

  schedule?: {
    id: string;
    scheduledDate?: string | null;
    preferredDate?: string | null;
    status?: string | null;
    notes?: string | null;
    requestedBy?: {
      id: string;
      displayName?: string | null;
      email?: string | null;
      role?: string | null;
    } | null;
  } | null;
}

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
    };

type CreateCollectionApiResponse = {
  collection?: Collection;
};

type UpdateCollectionStatusApiResponse = {
  collection?: Collection;
};

async function list(): Promise<Collection[]> {
  const response = await api.get<ListCollectionsApiResponse>(
    "/collections",
    true
  );

  if (Array.isArray(response)) {
    return response;
  }

  return response.collections ?? [];
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
      materials: payload.materials ?? undefined,
      notes: payload.notes?.trim() || undefined,
    },
    true
  );

  if (!response.collection) {
    throw new Error("Coleta não retornada pela API.");
  }

  return response.collection;
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
      materials: payload.materials ?? undefined,
      notes: payload.notes?.trim() || undefined,
    },
    true
  );

  if (!response.collection) {
    throw new Error("Coleta não retornada pela API.");
  }

  return response.collection;
}

export const collectionService = {
  list,
  create,
  updateStatus,
};

export default collectionService;