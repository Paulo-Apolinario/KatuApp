import {api} from "./api";

export type RouteStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";

export interface RouteItem {
  id: string;
  name: string;
  description?: string | null;
  scheduledDate?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  stops: string[];
  status: RouteStatus;
  createdAt?: string;
  updatedAt?: string;
}

type BackendRoute = {
  id: string;
  name: string;
  description?: string | null;
  scheduledDate?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  stops?: string[] | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type GetRoutesResponse = {
  routes?: BackendRoute[];
};

type GetRouteByIdResponse = {
  route?: BackendRoute;
};

export interface CreateRoutePayload {
  name: string;
  scheduledDate: string;
  driverId: string;
  vehicleId: string;
  stops: string[];
  description?: string;
}

function normalizeStatus(status?: string): RouteStatus {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "COMPLETED") return "COMPLETED";
  return "SCHEDULED";
}

function normalizeRoute(route: BackendRoute): RouteItem {
  return {
    id: route.id,
    name: route.name,
    description: route.description ?? null,
    scheduledDate: route.scheduledDate ?? null,
    driverId: route.driverId ?? null,
    vehicleId: route.vehicleId ?? null,
    stops: Array.isArray(route.stops) ? route.stops : [],
    status: normalizeStatus(route.status),
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}

export const routeService = {
  async create(payload: CreateRoutePayload): Promise<RouteItem> {
    const data = await api.post<BackendRoute>(
      "/routes",
      {
        name: payload.name.trim(),
        scheduledDate: payload.scheduledDate.trim(),
        driverId: payload.driverId,
        vehicleId: payload.vehicleId,
        stops: payload.stops,
        description: payload.description?.trim() || undefined,
      },
      true
    );

    return normalizeRoute(data);
  },

  async list(): Promise<RouteItem[]> {
    const data = await api.get<GetRoutesResponse | BackendRoute[]>("/routes", true);

    if (Array.isArray(data)) {
      return data.map(normalizeRoute);
    }

    const items = Array.isArray(data?.routes) ? data.routes : [];
    return items.map(normalizeRoute);
  },

  async getById(id: string): Promise<RouteItem> {
    const data = await api.get<GetRouteByIdResponse | BackendRoute>(
      `/routes/${id}`,
      true
    );

    if ("route" in (data as GetRouteByIdResponse)) {
      const route = (data as GetRouteByIdResponse).route;

      if (!route) {
        throw new Error("Rota não encontrada.");
      }

      return normalizeRoute(route);
    }

    return normalizeRoute(data as BackendRoute);
  },

  async updateStatus(id: string, status: RouteStatus): Promise<RouteItem> {
    const data = await api.patch<BackendRoute>(
      `/routes/${id}/status`,
      { status },
      true
    );

    return normalizeRoute(data);
  },
};

export default routeService;