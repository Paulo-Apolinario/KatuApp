import { api } from "./api";

export type CollectorStatus = "AVAILABLE" | "ON_ROUTE" | "INACTIVE";

export interface Collector {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
  address?: string | null;
  status: CollectorStatus;
  totalKg?: number | null;
  kgMonth?: number | null;
  collectionsToday?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

type BackendCollector = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
  address?: string | null;
  status?: string;
  totalKg?: number | null;
  kgMonth?: number | null;
  collectionsToday?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type GetCollectorsResponse = {
  collectors?: BackendCollector[];
};

type GetCollectorByIdResponse = {
  collector?: BackendCollector;
};

type UpdateCollectorStatusResponse = {
  collector?: BackendCollector;
};

export interface CreateCollectorPayload {
  name: string;
  email: string;
  phone?: string;
  document?: string;
  address?: string;
}

function normalizeStatus(status?: string): CollectorStatus {
  if (status === "ON_ROUTE") return "ON_ROUTE";
  if (status === "INACTIVE") return "INACTIVE";
  return "AVAILABLE";
}

function normalizeCollector(collector: BackendCollector): Collector {
  return {
    id: collector.id,
    name: collector.name,
    email: collector.email,
    phone: collector.phone ?? null,
    document: collector.document ?? null,
    address: collector.address ?? null,
    status: normalizeStatus(collector.status),
    totalKg: collector.totalKg ?? 0,
    kgMonth: collector.kgMonth ?? 0,
    collectionsToday: collector.collectionsToday ?? 0,
    createdAt: collector.createdAt,
    updatedAt: collector.updatedAt,
  };
}

function hasCollectorObject(
  data: unknown
): data is { collector?: BackendCollector } {
  return typeof data === "object" && data !== null && "collector" in data;
}

export const collectorService = {
  async create(payload: CreateCollectorPayload): Promise<Collector> {
    const data = await api.post<{ collector?: BackendCollector } | BackendCollector>(
      "/collectors",
      {
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone?.trim() || undefined,
        document: payload.document?.replace(/\D/g, "") || undefined,
        address: payload.address?.trim() || undefined,
      },
      true
    );

    if (hasCollectorObject(data) && data.collector) {
      return normalizeCollector(data.collector);
    }

    return normalizeCollector(data as BackendCollector);
  },

  async list(): Promise<Collector[]> {
    const data = await api.get<GetCollectorsResponse | BackendCollector[]>(
      "/collectors",
      true
    );

    if (Array.isArray(data)) {
      return data.map(normalizeCollector);
    }

    const items = Array.isArray(data.collectors) ? data.collectors : [];
    return items.map(normalizeCollector);
  },

  async getById(id: string): Promise<Collector> {
    const data = await api.get<GetCollectorByIdResponse | BackendCollector>(
      `/collectors/${id}`,
      true
    );

    if (hasCollectorObject(data)) {
      if (!data.collector) {
        throw new Error("Catador não encontrado.");
      }

      return normalizeCollector(data.collector);
    }

    return normalizeCollector(data as BackendCollector);
  },

  async updateStatus(id: string, status: CollectorStatus): Promise<Collector> {
    const data = await api.patch<
      UpdateCollectorStatusResponse | BackendCollector
    >(`/collectors/${id}/status`, { status }, true);

    if (hasCollectorObject(data)) {
      if (!data.collector) {
        throw new Error("Resposta inválida ao atualizar status do catador.");
      }

      return normalizeCollector(data.collector);
    }

    return normalizeCollector(data as BackendCollector);
  },
};

export default collectorService;