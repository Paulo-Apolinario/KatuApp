import { api } from "./api";

export type CollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Collection {
  id: string;
  cooperativeId: string;
  generatorId: string;
  collectorId?: string | null;
  scheduleId?: string | null;
  collectedAt?: string | null;
  totalWeightKg: number;
  materials: string[];
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
  } | null;
  schedule?: {
    id: string;
    scheduledDate?: string | null;
    preferredDate?: string | null;
    status?: string | null;
    notes?: string | null;
  } | null;
}

export interface CreateCollectionPayload {
  scheduleId: string;
  totalWeightKg: number;
  materials: string[];
  notes?: string;
  collectedAt?: string;
}

type ListCollectionsApiResponse =
  | Collection[]
  | {
      collections?: Collection[];
    };

type CreateCollectionApiResponse = {
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
    payload,
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
};

export default collectionService;