import { api } from "./api";
import { vehicleService, type Vehicle } from "./vehicleService";

export type DriverStatus = "AVAILABLE" | "ON_ROUTE" | "INACTIVE";

export type DriverReportType =
  | "DELAY"
  | "MECHANICAL_ISSUE"
  | "COLLECTION_NOT_COMPLETED"
  | "GENERAL_NOTE";

export interface Driver {
  id: string;
  name: string;
  email?: string | null;
  cpf?: string | null;
  phone?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  notes?: string | null;
  status: DriverStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverCooperative {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DriverProfile extends Driver {
  cooperative?: DriverCooperative | null;
  currentVehicle?: Vehicle | null;
}

export interface DriverReport {
  id: string;
  type: DriverReportType;
  description: string;
  routeId?: string | null;
  vehicleId?: string | null;
  collectionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  route?: {
    id: string;
    name?: string | null;
  } | null;
  vehicle?: {
    id: string;
    plate?: string | null;
    model?: string | null;
  } | null;
  collection?: {
    id: string;
    status?: string | null;
  } | null;
}

type BackendDriver = {
  id: string;
  name: string;
  email?: string | null;
  cpf?: string | null;
  phone?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  notes?: string | null;
  status?: DriverStatus | null;
  createdAt?: string;
  updatedAt?: string;
  cooperative?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

type BackendDriverReport = {
  id: string;
  type: DriverReportType;
  description: string;
  routeId?: string | null;
  vehicleId?: string | null;
  collectionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  route?: {
    id: string;
    name?: string | null;
  } | null;
  vehicle?: {
    id: string;
    plate?: string | null;
    model?: string | null;
  } | null;
  collection?: {
    id: string;
    status?: string | null;
  } | null;
};

type DriverEnvelope = {
  success?: boolean;
  driver?: BackendDriver;
  drivers?: BackendDriver[];
  reports?: BackendDriverReport[];
  report?: BackendDriverReport;
  error?: string;
};

export interface CreateDriverPayload {
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  cnh?: string;
  cnhCategory?: string;
  notes?: string;
}

export interface UpdateMyDriverProfilePayload {
  displayName: string;
  phone?: string;
  cnh?: string;
  cnhCategory?: string;
  notes?: string;
}

export interface CreateDriverReportPayload {
  type: DriverReportType;
  description: string;
  routeId?: string;
  vehicleId?: string;
  collectionId?: string;
}

export function translateDriverStatus(status?: string | null) {
  switch (status) {
    case "AVAILABLE":
      return "Disponível";
    case "ON_ROUTE":
      return "Em rota";
    case "INACTIVE":
      return "Inativo";
    default:
      return "Não informado";
  }
}

function normalizeDriver(driver: BackendDriver): DriverProfile {
  return {
    id: driver.id,
    name: driver.name,
    email: driver.email ?? null,
    cpf: driver.cpf ?? null,
    phone: driver.phone ?? null,
    cnh: driver.cnh ?? null,
    cnhCategory: driver.cnhCategory ?? null,
    notes: driver.notes ?? null,
    status: driver.status ?? "AVAILABLE",
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
    cooperative: driver.cooperative
      ? {
          id: driver.cooperative.id,
          name: driver.cooperative.name,
          email: driver.cooperative.email ?? null,
          phone: driver.cooperative.phone ?? null,
          address: driver.cooperative.address ?? null,
          latitude: driver.cooperative.latitude ?? null,
          longitude: driver.cooperative.longitude ?? null,
        }
      : null,
    currentVehicle: null,
  };
}

function normalizeReport(report: BackendDriverReport): DriverReport {
  return {
    id: report.id,
    type: report.type,
    description: report.description,
    routeId: report.routeId ?? null,
    vehicleId: report.vehicleId ?? null,
    collectionId: report.collectionId ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    route: report.route ?? null,
    vehicle: report.vehicle ?? null,
    collection: report.collection ?? null,
  };
}

export const driverService = {
  async create(payload: CreateDriverPayload): Promise<Driver> {
    const response = await api.post<DriverEnvelope>(
      "/drivers",
      {
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        cpf: payload.cpf?.replace(/\D/g, "") || undefined,
        phone: payload.phone?.trim() || undefined,
        cnh: payload.cnh?.trim() || undefined,
        cnhCategory: payload.cnhCategory?.trim().toUpperCase() || undefined,
        notes: payload.notes?.trim() || undefined,
      },
      true
    );

    if (!response?.driver) {
      throw new Error("Resposta inválida ao criar motorista.");
    }

    return normalizeDriver(response.driver);
  },

  async list(): Promise<Driver[]> {
    const response = await api.get<DriverEnvelope>("/drivers", true);
    const items = Array.isArray(response?.drivers) ? response.drivers : [];
    return items.map(normalizeDriver);
  },

  async getById(id: string): Promise<Driver> {
    const response = await api.get<DriverEnvelope>(`/drivers/${id}`, true);

    if (!response?.driver) {
      throw new Error("Motorista não encontrado.");
    }

    return normalizeDriver(response.driver);
  },

  async getMe(): Promise<DriverProfile> {
    const response = await api.get<DriverEnvelope>("/drivers/me", true);

    if (!response?.driver) {
      throw new Error("Perfil do motorista não encontrado.");
    }

    return normalizeDriver(response.driver);
  },

  async getMyProfile(): Promise<DriverProfile> {
    return this.getMe();
  },

  async getMeWithVehicle(driverId?: string | null): Promise<DriverProfile> {
    const profile = await this.getMe();
    const vehicle = await vehicleService.getCurrentByDriver(driverId || profile.id);
    return {
      ...profile,
      currentVehicle: vehicle,
    };
  },

  async getMyProfileWithVehicle(driverId?: string | null): Promise<DriverProfile> {
    return this.getMeWithVehicle(driverId);
  },

  async updateMyProfile(
    payload: UpdateMyDriverProfilePayload
  ): Promise<DriverProfile> {
    const response = await api.patch<DriverEnvelope>(
      "/drivers/me",
      {
        displayName: payload.displayName.trim(),
        phone: payload.phone?.trim() || undefined,
        cnh: payload.cnh?.trim() || undefined,
        cnhCategory: payload.cnhCategory?.trim().toUpperCase() || undefined,
        notes: payload.notes?.trim() || undefined,
      },
      true
    );

    if (!response?.driver) {
      throw new Error("Resposta inválida ao atualizar perfil do motorista.");
    }

    return normalizeDriver(response.driver);
  },

  async listMyReports(): Promise<DriverReport[]> {
    const response = await api.get<DriverEnvelope>("/drivers/me/reports", true);
    const items = Array.isArray(response?.reports) ? response.reports : [];
    return items.map(normalizeReport);
  },

  async createMyReport(
    payload: CreateDriverReportPayload
  ): Promise<DriverReport> {
    const response = await api.post<DriverEnvelope>(
      "/drivers/me/reports",
      {
        type: payload.type,
        description: payload.description.trim(),
        routeId: payload.routeId || undefined,
        vehicleId: payload.vehicleId || undefined,
        collectionId: payload.collectionId || undefined,
      },
      true
    );

    if (!response?.report) {
      throw new Error("Resposta inválida ao registrar ocorrência.");
    }

    return normalizeReport(response.report);
  },

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    const response = await api.patch<DriverEnvelope>(
      `/drivers/${id}/status`,
      { status },
      true
    );

    if (!response?.driver) {
      throw new Error("Resposta inválida ao atualizar status do motorista.");
    }

    return normalizeDriver(response.driver);
  },
};

export default driverService;