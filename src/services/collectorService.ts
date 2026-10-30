import { api, isApiNetworkError } from "./api";
import { collectionService } from "./collectionService";

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

function hasCollectorsArray(
  data: unknown
): data is { collectors?: BackendCollector[] } {
  return typeof data === "object" && data !== null && "collectors" in data;
}

function getCollectionCollectorId(collection: any) {
  return (
    collection?.collectorId ||
    collection?.collector?.id ||
    collection?.assignedCollectorId ||
    null
  );
}

function getCollectionDate(collection: any) {
  return (
    collection?.collectedAt ||
    collection?.completedAt ||
    collection?.updatedAt ||
    collection?.createdAt ||
    null
  );
}

function isSameMonth(dateValue?: string | null) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function isToday(dateValue?: string | null) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

async function enrichCollectorsWithStats(
  collectors: Collector[]
): Promise<Collector[]> {
  try {
    const collections = await collectionService.list();

    return collectors.map((collector) => {
      const collectorCollections = collections.filter((collection: any) => {
        return getCollectionCollectorId(collection) === collector.id;
      });

      const completedCollections = collectorCollections.filter(
        (collection: any) => collection.status === "COMPLETED"
      );

      const totalKg = completedCollections.reduce((acc: number, item: any) => {
        return acc + Number(item.totalWeightKg ?? 0);
      }, 0);

      const kgMonth = completedCollections
        .filter((item: any) => isSameMonth(getCollectionDate(item)))
        .reduce((acc: number, item: any) => {
          return acc + Number(item.totalWeightKg ?? 0);
        }, 0);

      const collectionsToday = completedCollections.filter((item: any) =>
        isToday(getCollectionDate(item))
      ).length;

      return {
        ...collector,
        totalKg,
        kgMonth,
        collectionsToday,
      };
    });
  } catch (error) {
    console.error("Erro ao calcular estatísticas dos catadores:", error);
    return collectors;
  }
}

async function readCollectorsFromCollections(): Promise<Collector[]> {
  try {
    const collections = await collectionService.list();
    const map = new Map<string, Collector>();

    for (const collection of collections as any[]) {
      const collector = collection.collector;

      if (!collector?.id) continue;

      if (!map.has(collector.id)) {
        map.set(collector.id, {
          id: collector.id,
          name: collector.name || collector.displayName || "Catador",
          email: collector.email || "",
          phone: collector.phone ?? null,
          document: null,
          status: "AVAILABLE",
          totalKg: 0,
          kgMonth: 0,
          collectionsToday: 0,
          createdAt: undefined,
          updatedAt: undefined,
        });
      }
    }

    return enrichCollectorsWithStats(Array.from(map.values()));
  } catch {
    return [];
  }
}

async function readCollectorByIdFromCollections(
  id: string
): Promise<Collector | null> {
  try {
    const collectors = await readCollectorsFromCollections();
    return collectors.find((item) => item.id === id) || null;
  } catch {
    return null;
  }
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
    try {
      const data = await api.get<GetCollectorsResponse | BackendCollector[]>(
        "/collectors",
        true
      );

      let collectors: Collector[] = [];

      if (Array.isArray(data)) {
        collectors = data.map(normalizeCollector);
      } else if (hasCollectorsArray(data)) {
        const items = Array.isArray(data.collectors) ? data.collectors : [];
        collectors = items.map(normalizeCollector);
      }

      return enrichCollectorsWithStats(collectors);
    } catch (error) {
      if (isApiNetworkError(error)) {
        return readCollectorsFromCollections();
      }

      throw error;
    }
  },

  async getById(id: string): Promise<Collector> {
    try {
      const data = await api.get<GetCollectorByIdResponse | BackendCollector>(
        `/collectors/${id}`,
        true
      );

      let collector: Collector;

      if (hasCollectorObject(data)) {
        if (!data.collector) {
          throw new Error("Catador não encontrado.");
        }

        collector = normalizeCollector(data.collector);
      } else {
        collector = normalizeCollector(data as BackendCollector);
      }

      const enriched = await enrichCollectorsWithStats([collector]);
      return enriched[0];
    } catch (error) {
      if (isApiNetworkError(error)) {
        const cached = await readCollectorByIdFromCollections(id);

        if (cached) {
          return cached;
        }
      }

      throw error;
    }
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