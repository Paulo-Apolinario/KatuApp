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
  document?: string | null;
  phone?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  notes?: string | null;
  status?: string | null;
  isActive?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
};

type ListDriversResponse =
  | BackendDriver[]
  | {
      drivers?: BackendDriver[];
    };

export interface CreateDriverPayload {
  name: string;
  email?: string;
  cpf?: string;
  phone?: string;
  cnh?: string;
  cnhCategory?: string;
  notes?: string;
}

function normalizeStatus(driver: BackendDriver): DriverStatus {
  if (driver.status === "AVAILABLE") return "AVAILABLE";
  if (driver.status === "ON_ROUTE") return "ON_ROUTE";
  if (driver.status === "INACTIVE") return "INACTIVE";

  if (driver.isActive === false) return "INACTIVE";

  return "AVAILABLE";
}

function normalizeDriver(driver: BackendDriver): Driver {
  return {
    id: driver.id,
    name: driver.name,
    email: driver.email ?? null,
    cpf: driver.document ?? null,
    phone: driver.phone ?? null,
    cnh: driver.cnh ?? null,
    cnhCategory: driver.cnhCategory ?? null,
    notes: driver.notes ?? null,
    status: normalizeStatus(driver),
    createdAt: driver.createdAt,
    updatedAt: driver.updatedAt,
  };
}

export const driverService = {
  async create(payload: CreateDriverPayload): Promise<Driver> {
    const data = await api.post<BackendDriver>(
      "/drivers",
      {
        name: payload.name.trim(),
        email: payload.email?.trim().toLowerCase() || undefined,
        document: payload.cpf?.replace(/\D/g, "") || undefined,
        phone: payload.phone?.trim() || undefined,
        cnh: payload.cnh?.trim() || undefined,
        cnhCategory: payload.cnhCategory?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
      },
      true
    );

    return normalizeDriver(data);
  },

  async list(): Promise<Driver[]> {
    const data = await api.get<ListDriversResponse>("/drivers", true);
    const items = Array.isArray(data) ? data : data.drivers ?? [];
    return items.map(normalizeDriver);
  },

  async getById(id: string): Promise<Driver> {
    const data = await api.get<BackendDriver>(`/drivers/${id}`, true);
    return normalizeDriver(data);
  },

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    const data = await api.patch<BackendDriver>(
      `/drivers/${id}/status`,
      { status },
      true
    );

    return normalizeDriver(data);
  },
};

export default driverService;