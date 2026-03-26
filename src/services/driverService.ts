import { api } from "./api";

export type DriverStatus = "AVAILABLE" | "ON_ROUTE" | "INACTIVE";

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
};

type DriverEnvelope = {
  success?: boolean;
  driver?: BackendDriver;
  drivers?: BackendDriver[];
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

function normalizeDriver(driver: BackendDriver): Driver {
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

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    const response = await api.patch<DriverEnvelope>(
      `/drivers/${id}/status`,
      { status },
      true
    );

    if (!response?.driver) {
      throw new Error("Resposta inválida ao atualizar motorista.");
    }

    return normalizeDriver(response.driver);
  },
};

export default driverService;