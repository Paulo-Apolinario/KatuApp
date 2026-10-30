import { api, isApiNetworkError } from "./api";
import { routeService } from "./routeService";

export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand?: string | null;
  year?: number | null;
  capacityKg?: number | null;
  status: VehicleStatus;
  driverId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type BackendVehicle = {
  id: string;
  plate: string;
  model: string;
  brand?: string | null;
  year?: number | null;
  capacityKg?: number | null;
  status?: VehicleStatus | null;
  driverId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type VehicleEnvelope = {
  success?: boolean;
  vehicle?: BackendVehicle;
  vehicles?: BackendVehicle[];
  error?: string;
};

export interface CreateVehiclePayload {
  plate: string;
  model: string;
  brand?: string;
  year?: string | number;
  capacityKg?: string | number;
  driverId?: string;
}

function normalizeStatus(status?: string | null): VehicleStatus {
  if (status === "MAINTENANCE") return "MAINTENANCE";
  if (status === "INACTIVE") return "INACTIVE";
  return "ACTIVE";
}

export function translateVehicleStatus(status?: string | null) {
  switch (status) {
    case "ACTIVE":
      return "Ativo";
    case "MAINTENANCE":
      return "Em manutenção";
    case "INACTIVE":
      return "Inativo";
    default:
      return "Não informado";
  }
}

function normalizeVehicle(vehicle: BackendVehicle): Vehicle {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    brand: vehicle.brand ?? null,
    year: vehicle.year ?? null,
    capacityKg: vehicle.capacityKg ?? null,
    driverId: vehicle.driverId ?? null,
    status: normalizeStatus(vehicle.status),
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

function sanitizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function normalizeRouteVehicle(vehicle: any, driverId?: string | null): Vehicle | null {
  if (!vehicle?.id) return null;

  return {
    id: vehicle.id,
    plate: vehicle.plate ?? "",
    model: vehicle.model ?? "",
    brand: vehicle.brand ?? null,
    year: vehicle.year ?? null,
    capacityKg: vehicle.capacityKg ?? null,
    driverId: driverId ?? null,
    status: normalizeStatus(vehicle.status),
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

async function readVehiclesFromRoutes(driverId?: string | null): Promise<Vehicle[]> {
  try {
    const routes = driverId
      ? await routeService.listByDriver(driverId)
      : await routeService.list();

    const map = new Map<string, Vehicle>();

    for (const route of routes) {
      const normalized = normalizeRouteVehicle(route.vehicle, route.driverId ?? driverId);
      if (normalized?.id) {
        map.set(normalized.id, normalized);
      }
    }

    return Array.from(map.values());
  } catch {
    return [];
  }
}

async function readVehicleByIdFromRoutes(id: string): Promise<Vehicle | null> {
  try {
    const routes = await routeService.list();

    for (const route of routes) {
      const normalized = normalizeRouteVehicle(route.vehicle, route.driverId ?? null);
      if (normalized?.id === id) {
        return normalized;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export const vehicleService = {
  async create(payload: CreateVehiclePayload): Promise<Vehicle> {
    const parsedYear =
      payload.year !== undefined && String(payload.year).trim() !== ""
        ? Number(payload.year)
        : undefined;

    const parsedCapacityKg =
      payload.capacityKg !== undefined && String(payload.capacityKg).trim() !== ""
        ? Number(String(payload.capacityKg).replace(",", "."))
        : undefined;

    const response = await api.post<VehicleEnvelope>(
      "/vehicles",
      {
        plate: sanitizePlate(payload.plate),
        model: payload.model.trim(),
        brand: payload.brand?.trim() || undefined,
        year:
          parsedYear !== undefined && !Number.isNaN(parsedYear)
            ? parsedYear
            : undefined,
        capacityKg:
          parsedCapacityKg !== undefined && !Number.isNaN(parsedCapacityKg)
            ? parsedCapacityKg
            : undefined,
        driverId: payload.driverId || undefined,
      },
      true
    );

    if (!response?.vehicle) {
      throw new Error("Resposta inválida ao criar veículo.");
    }

    return normalizeVehicle(response.vehicle);
  },

  async list(): Promise<Vehicle[]> {
    try {
      const response = await api.get<VehicleEnvelope>("/vehicles", true);
      const items = Array.isArray(response?.vehicles) ? response.vehicles : [];
      return items.map(normalizeVehicle);
    } catch (error) {
      if (isApiNetworkError(error)) {
        return readVehiclesFromRoutes();
      }

      throw error;
    }
  },

  async listByDriver(driverId?: string | null): Promise<Vehicle[]> {
    try {
      const vehicles = await this.list();

      if (!driverId) return vehicles;

      const filtered = vehicles.filter((vehicle) => vehicle.driverId === driverId);

      if (filtered.length > 0) {
        return filtered;
      }

      return readVehiclesFromRoutes(driverId);
    } catch (error) {
      if (isApiNetworkError(error)) {
        return readVehiclesFromRoutes(driverId);
      }

      throw error;
    }
  },

  async getCurrentByDriver(driverId?: string | null): Promise<Vehicle | null> {
    try {
      const vehicles = await this.listByDriver(driverId);

      if (vehicles.length > 0) {
        return vehicles[0];
      }

      if (driverId) {
        const nextRoute = await routeService.getNextRouteByDriver(driverId);

        if (nextRoute?.vehicle) {
          return normalizeRouteVehicle(nextRoute.vehicle, driverId);
        }

        const activeRoutes = await routeService.listActiveByDriver(driverId);
        const routeWithVehicle = activeRoutes.find((route) => route.vehicle?.id);

        if (routeWithVehicle?.vehicle) {
          return normalizeRouteVehicle(routeWithVehicle.vehicle, driverId);
        }
      }

      return null;
    } catch (error) {
      if (driverId) {
        try {
          const nextRoute = await routeService.getNextRouteByDriver(driverId);

          if (nextRoute?.vehicle) {
            return normalizeRouteVehicle(nextRoute.vehicle, driverId);
          }

          const activeRoutes = await routeService.listActiveByDriver(driverId);
          const routeWithVehicle = activeRoutes.find((route) => route.vehicle?.id);

          if (routeWithVehicle?.vehicle) {
            return normalizeRouteVehicle(routeWithVehicle.vehicle, driverId);
          }
        } catch {
          return null;
        }
      }

      if (isApiNetworkError(error)) {
        const routeVehicles = await readVehiclesFromRoutes(driverId);
        return routeVehicles.length > 0 ? routeVehicles[0] : null;
      }

      throw error;
    }
  },

  async getById(id: string): Promise<Vehicle> {
    try {
      const response = await api.get<VehicleEnvelope>(`/vehicles/${id}`, true);

      if (!response?.vehicle) {
        throw new Error("Veículo não encontrado.");
      }

      return normalizeVehicle(response.vehicle);
    } catch (error) {
      if (isApiNetworkError(error)) {
        const cached = await readVehicleByIdFromRoutes(id);

        if (cached) {
          return cached;
        }
      }

      throw error;
    }
  },

  async updateStatus(id: string, status: VehicleStatus): Promise<Vehicle> {
    const response = await api.patch<VehicleEnvelope>(
      `/vehicles/${id}/status`,
      { status },
      true
    );

    if (!response?.vehicle) {
      throw new Error("Resposta inválida ao atualizar veículo.");
    }

    return normalizeVehicle(response.vehicle);
  },
};

export default vehicleService;