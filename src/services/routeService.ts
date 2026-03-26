import { api } from "./api";

export type RouteStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

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
  driver?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  vehicle?: {
    id: string;
    plate?: string | null;
    model?: string | null;
    brand?: string | null;
  } | null;
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
  driver?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  vehicle?: {
    id: string;
    plate?: string | null;
    model?: string | null;
    brand?: string | null;
  } | null;
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
  driverId?: string;
  vehicleId?: string;
  stops: string[];
  description?: string;
}

function normalizeStatus(status?: string): RouteStatus {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
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
    driver: route.driver
      ? {
          id: route.driver.id,
          name: route.driver.name ?? null,
          email: route.driver.email ?? null,
          phone: route.driver.phone ?? null,
        }
      : null,
    vehicle: route.vehicle
      ? {
          id: route.vehicle.id,
          plate: route.vehicle.plate ?? null,
          model: route.vehicle.model ?? null,
          brand: route.vehicle.brand ?? null,
        }
      : null,
  };
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
        stops: payload.stops,
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

  async getById(id: string): Promise<RouteItem> {
    const response = await api.get<GetRouteByIdResponse>(`/routes/${id}`, true);

    if (!response?.route) {
      throw new Error("Rota não encontrada.");
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
};

export default routeService;