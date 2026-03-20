import {api} from "./api";

export type VehicleStatus = "ACTIVE" | "MAINTENANCE" | "INACTIVE";

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand?: string | null;
  year?: number | null;
  capacityKg?: number | null;
  status: VehicleStatus;
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
  status?: VehicleStatus;
  createdAt?: string;
  updatedAt?: string;
};

type GetVehiclesResponse = {
  vehicles?: BackendVehicle[];
};

type GetVehicleByIdResponse = {
  vehicle?: BackendVehicle;
};

export interface CreateVehiclePayload {
  plate: string;
  model: string;
  brand?: string;
  year?: string | number;
  capacityKg?: string | number;
}

function normalizeStatus(status?: string): VehicleStatus {
  if (status === "MAINTENANCE") return "MAINTENANCE";
  if (status === "INACTIVE") return "INACTIVE";
  return "ACTIVE";
}

function normalizeVehicle(vehicle: BackendVehicle): Vehicle {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    brand: vehicle.brand ?? null,
    year: vehicle.year ?? null,
    capacityKg: vehicle.capacityKg ?? null,
    status: normalizeStatus(vehicle.status),
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

function sanitizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
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

    const data = await api.post<BackendVehicle>(
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
      },
      true
    );

    return normalizeVehicle(data);
  },

  async list(): Promise<Vehicle[]> {
    const data = await api.get<GetVehiclesResponse | BackendVehicle[]>(
      "/vehicles",
      true
    );

    if (Array.isArray(data)) {
      return data.map(normalizeVehicle);
    }

    const items = Array.isArray(data?.vehicles) ? data.vehicles : [];
    return items.map(normalizeVehicle);
  },

  async getById(id: string): Promise<Vehicle> {
    const data = await api.get<GetVehicleByIdResponse | BackendVehicle>(
      `/vehicles/${id}`,
      true
    );

    if ("vehicle" in (data as GetVehicleByIdResponse)) {
      const vehicle = (data as GetVehicleByIdResponse).vehicle;
      if (!vehicle) {
        throw new Error("Veículo não encontrado.");
      }
      return normalizeVehicle(vehicle);
    }

    return normalizeVehicle(data as BackendVehicle);
  },

  async updateStatus(id: string, status: VehicleStatus): Promise<Vehicle> {
    const data = await api.patch<BackendVehicle>(
      `/vehicles/${id}/status`,
      { status },
      true
    );

    return normalizeVehicle(data);
  },
};

export default vehicleService;