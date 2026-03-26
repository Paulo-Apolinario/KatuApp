import { api } from "./api";

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
    const response = await api.get<VehicleEnvelope>("/vehicles", true);
    const items = Array.isArray(response?.vehicles) ? response.vehicles : [];
    return items.map(normalizeVehicle);
  },

  async getById(id: string): Promise<Vehicle> {
    const response = await api.get<VehicleEnvelope>(`/vehicles/${id}`, true);

    if (!response?.vehicle) {
      throw new Error("Veículo não encontrado.");
    }

    return normalizeVehicle(response.vehicle);
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