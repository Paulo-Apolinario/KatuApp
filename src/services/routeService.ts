import { api } from "./api";
import type { Collection, CollectionStatus } from "../types/collection";

export type RouteStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface RouteStats {
  totalCollections: number;
  pendingCollections: number;
  inProgressCollections: number;
  completedCollections: number;
  cancelledCollections: number;
}

export interface RouteItem {
  id: string;
  name: string;
  description?: string | null;
  scheduledDate?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  cooperativeId?: string | null;
  stops: string[];
  status: RouteStatus;
  createdAt?: string;
  updatedAt?: string;

  driver?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    cpf?: string | null;
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

  cooperative?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;

  collections?: Collection[];
  activeCollections?: Collection[];
  stats?: RouteStats | null;
}

type BackendRoute = {
  id: string;
  name: string;
  description?: string | null;
  scheduledDate?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  cooperativeId?: string | null;
  stops?: string[] | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;

  driver?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    cpf?: string | null;
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

  cooperative?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;

  collections?: BackendCollection[] | null;
  activeCollections?: BackendCollection[] | null;
  stats?: Partial<RouteStats> | null;
};

type BackendCollection = {
  id: string;
  cooperativeId?: string;
  generatorId?: string | null;
  collectorId?: string | null;
  scheduleId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
  collectedAt?: string | null;
  totalWeightKg?: number;
  materials?: { type: string; quantityKg: number }[] | [null];
  notes?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;

  generator?: {
    id: string;
    name?: string | null;
    companyName?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    city?: string | null;
    state?: string | null;
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
    stops?: string[] | null;
    status?: string | null;
    driverId?: string | null;
  } | null;

  schedule?: {
    id: string;
    scheduledDate?: string | null;
    preferredDate?: string | null;
    status?: string | null;
    notes?: string | null;
  } | null;
};

type GetRoutesResponse = {
  routes?: BackendRoute[];
};

type GetRouteByIdResponse = {
  route?: BackendRoute;
};

type GetAvailableCollectionsResponse = {
  collections?: BackendCollection[];
};

type CollectionMutationResponse = {
  collection?: BackendCollection;
};

export interface CreateRoutePayload {
  name: string;
  scheduledDate: string;
  driverId?: string;
  vehicleId?: string;
  stops: string[];
  description?: string;
}

export interface UpdateRoutePayload {
  name?: string;
  scheduledDate?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  stops?: string[];
  description?: string | null;
}

export function translateRouteStatus(status?: string | null) {
  switch (status) {
    case "SCHEDULED":
      return "Agendada";
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

function normalizeStatus(status?: string): RouteStatus {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  return "SCHEDULED";
}

function normalizeCollectionStatus(status?: string): CollectionStatus {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  return "PENDING";
}

function normalizeCollection(collection: BackendCollection): Collection {
  return {
    id: collection.id,
    cooperativeId: collection.cooperativeId ?? "",
    generatorId: collection.generatorId ?? null,
    collectorId: collection.collectorId ?? null,
    scheduleId: collection.scheduleId ?? null,
    driverId: collection.driverId ?? null,
    vehicleId: collection.vehicleId ?? null,
    routeId: collection.routeId ?? null,
    collectedAt: collection.collectedAt ?? null,
    totalWeightKg: Number(collection.totalWeightKg ?? 0),
    materials: Array.isArray(collection.materials)
      ? collection.materials.map((item) => ({
          type: item?.type ?? "",
          quantityKg: Number(item?.quantityKg ?? 0),
        }))
      : [],
    notes: collection.notes ?? null,
    status: normalizeCollectionStatus(collection.status),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,

    generator: collection.generator
      ? {
          id: collection.generator.id,
          name: collection.generator.name ?? null,
          companyName: collection.generator.companyName ?? null,
          address: collection.generator.address ?? null,
          latitude: collection.generator.latitude ?? null,
          longitude: collection.generator.longitude ?? null,
        }
      : null,

    collector: collection.collector
      ? {
          id: collection.collector.id,
          name: collection.collector.name ?? null,
          email: collection.collector.email ?? null,
          phone: collection.collector.phone ?? null,
        }
      : null,

    driver: collection.driver
      ? {
          id: collection.driver.id,
          name: collection.driver.name ?? null,
          email: collection.driver.email ?? null,
          phone: collection.driver.phone ?? null,
          cnh: collection.driver.cnh ?? null,
          cnhCategory: collection.driver.cnhCategory ?? null,
          status: collection.driver.status ?? null,
        }
      : null,

    vehicle: collection.vehicle
      ? {
          id: collection.vehicle.id,
          plate: collection.vehicle.plate ?? null,
          model: collection.vehicle.model ?? null,
          brand: collection.vehicle.brand ?? null,
          year: collection.vehicle.year ?? null,
          capacityKg: collection.vehicle.capacityKg ?? null,
          status: collection.vehicle.status ?? null,
        }
      : null,

    route: collection.route
      ? {
          id: collection.route.id,
          name: collection.route.name ?? null,
          description: collection.route.description ?? null,
          scheduledDate: collection.route.scheduledDate ?? null,
          stops: Array.isArray(collection.route.stops)
            ? collection.route.stops
            : [],
          status: collection.route.status ?? null,
          driverId: collection.route.driverId ?? null,
        }
      : null,

    schedule: collection.schedule
      ? {
          id: collection.schedule.id,
          scheduledDate: collection.schedule.scheduledDate ?? null,
          preferredDate: collection.schedule.preferredDate ?? null,
          status: collection.schedule.status ?? null,
          notes: collection.schedule.notes ?? null,
        }
      : null,
  };
}

function normalizeStats(stats?: Partial<RouteStats> | null): RouteStats {
  return {
    totalCollections: Number(stats?.totalCollections ?? 0),
    pendingCollections: Number(stats?.pendingCollections ?? 0),
    inProgressCollections: Number(stats?.inProgressCollections ?? 0),
    completedCollections: Number(stats?.completedCollections ?? 0),
    cancelledCollections: Number(stats?.cancelledCollections ?? 0),
  };
}

function normalizeRoute(route: BackendRoute): RouteItem {
  return {
    id: route.id,
    name: route.name,
    description: route.description ?? null,
    scheduledDate: route.scheduledDate ?? null,
    driverId: route.driverId ?? null,
    vehicleId: route.vehicleId ?? null,
    cooperativeId: route.cooperativeId ?? null,
    stops: Array.isArray(route.stops) ? route.stops : [],
    status: normalizeStatus(route.status),
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,

    driver: route.driver
      ? {
          id: route.driver.id,
          name: route.driver.name ?? null,
          email: route.driver.email ?? null,
          phone: route.driver.phone ?? null,
          cpf: route.driver.cpf ?? null,
          cnh: route.driver.cnh ?? null,
          cnhCategory: route.driver.cnhCategory ?? null,
          status: route.driver.status ?? null,
        }
      : null,

    vehicle: route.vehicle
      ? {
          id: route.vehicle.id,
          plate: route.vehicle.plate ?? null,
          model: route.vehicle.model ?? null,
          brand: route.vehicle.brand ?? null,
          year: route.vehicle.year ?? null,
          capacityKg: route.vehicle.capacityKg ?? null,
          status: route.vehicle.status ?? null,
        }
      : null,

    cooperative: route.cooperative
      ? {
          id: route.cooperative.id,
          name: route.cooperative.name ?? null,
          email: route.cooperative.email ?? null,
          phone: route.cooperative.phone ?? null,
          address: route.cooperative.address ?? null,
          latitude: route.cooperative.latitude ?? null,
          longitude: route.cooperative.longitude ?? null,
        }
      : null,

    collections: Array.isArray(route.collections)
      ? route.collections.map(normalizeCollection)
      : [],

    activeCollections: Array.isArray(route.activeCollections)
      ? route.activeCollections.map(normalizeCollection)
      : [],

    stats: normalizeStats(route.stats),
  };
}

function sortByScheduledDateAsc(items: RouteItem[]): RouteItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
    const bTime = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
    return aTime - bTime;
  });
}

export const routeService = {
  async create(payload: CreateRoutePayload): Promise<RouteItem> {
    const response = await api.post<GetRouteByIdResponse>(
      "/routes",
      {
        name: payload.name.trim(),
        scheduledDate: payload.scheduledDate.trim(),
        driverId: payload.driverId || undefined,
        vehicleId: payload.vehicleId || undefined,
        stops: payload.stops.map((item) => item.trim()).filter(Boolean),
        description: payload.description?.trim() || undefined,
      },
      true
    );

    if (!response?.route) {
      throw new Error("Resposta inválida ao criar rota.");
    }

    return normalizeRoute(response.route);
  },

  async list(): Promise<RouteItem[]> {
    const response = await api.get<GetRoutesResponse>("/routes", true);
    const items = Array.isArray(response?.routes) ? response.routes : [];
    return items.map(normalizeRoute);
  },

  async listByDriver(driverId?: string | null): Promise<RouteItem[]> {
    const routes = await this.list();

    if (!driverId) return sortByScheduledDateAsc(routes);

    const filtered = routes.filter((route) => route.driverId === driverId);

    // fallback: quando o backend do motorista já retorna só as rotas dele
    return sortByScheduledDateAsc(filtered.length > 0 ? filtered : routes);
  },

  async listActiveByDriver(driverId?: string | null): Promise<RouteItem[]> {
    const routes = await this.listByDriver(driverId);
    return routes.filter(
      (route) =>
        route.status === "SCHEDULED" || route.status === "IN_PROGRESS"
    );
  },

  async getNextRouteByDriver(driverId?: string | null): Promise<RouteItem | null> {
    const routes = await this.listActiveByDriver(driverId);
    return routes.length > 0 ? routes[0] : null;
  },

  async getById(id: string): Promise<RouteItem> {
    const response = await api.get<GetRouteByIdResponse>(`/routes/${id}`, true);

    if (!response?.route) {
      throw new Error("Rota não encontrada.");
    }

    return normalizeRoute(response.route);
  },

  async update(id: string, payload: UpdateRoutePayload): Promise<RouteItem> {
    const response = await api.patch<GetRouteByIdResponse>(
      `/routes/${id}`,
      {
        name: payload.name?.trim(),
        scheduledDate:
          payload.scheduledDate === undefined
            ? undefined
            : payload.scheduledDate,
        driverId:
          payload.driverId === undefined ? undefined : payload.driverId,
        vehicleId:
          payload.vehicleId === undefined ? undefined : payload.vehicleId,
        stops: payload.stops?.map((item) => item.trim()).filter(Boolean),
        description:
          payload.description === undefined
            ? undefined
            : payload.description?.trim() || null,
      },
      true
    );

    if (!response?.route) {
      throw new Error("Resposta inválida ao atualizar rota.");
    }

    return normalizeRoute(response.route);
  },

  async updateStatus(id: string, status: RouteStatus): Promise<RouteItem> {
    const response = await api.patch<GetRouteByIdResponse>(
      `/routes/${id}/status`,
      { status },
      true
    );

    if (!response?.route) {
      throw new Error("Resposta inválida ao atualizar rota.");
    }

    return normalizeRoute(response.route);
  },

  async listAvailableCollections(): Promise<Collection[]> {
    const response = await api.get<GetAvailableCollectionsResponse>(
      "/routes/available-collections",
      true
    );

    const items = Array.isArray(response?.collections)
      ? response.collections
      : [];

    return items.map(normalizeCollection);
  },

  async addCollectionToRoute(
    routeId: string,
    collectionId: string
  ): Promise<Collection> {
    const response = await api.post<CollectionMutationResponse>(
      `/routes/${routeId}/collections/${collectionId}`,
      {},
      true
    );

    if (!response?.collection) {
      throw new Error("Resposta inválida ao adicionar coleta na rota.");
    }

    return normalizeCollection(response.collection);
  },

  async removeCollectionFromRoute(
    routeId: string,
    collectionId: string
  ): Promise<Collection> {
    const response = await api.delete<CollectionMutationResponse>(
      `/routes/${routeId}/collections/${collectionId}`,
      true
    );

    if (!response?.collection) {
      throw new Error("Resposta inválida ao remover coleta da rota.");
    }

    return normalizeCollection(response.collection);
  },
};

export default routeService;