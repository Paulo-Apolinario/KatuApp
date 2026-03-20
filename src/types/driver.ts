export type DriverStatus = "AVAILABLE" | "ON_ROUTE" | "INACTIVE";

export interface Driver {
  id: string;
  name: string;
  cpf?: string | null;
  phone?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  status: DriverStatus;
  notes?: string | null;
  cooperativeId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDriverPayload {
  name: string;
  cpf?: string;
  phone?: string;
  cnh?: string;
  cnhCategory?: string;
  notes?: string;
}