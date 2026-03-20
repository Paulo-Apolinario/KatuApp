export type UserRole =
  | "PF"
  | "GENERATOR_SMALL"
  | "GENERATOR_LARGE"
  | "COOPERATIVE"
  | "COLLECTOR"
  | "ADMIN";

export interface PersonProfile {
  id: string;
  cpf: string;
  address?: string | null;
  totalKg: number;
  greenStreak: number;
}

export interface GeneratorProfile {
  id: string;
  cooperativeId: string;
  userId?: string | null;
  type: "SMALL" | "LARGE";
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  status?: string | null;
  accessReleased: boolean;
  accessStatus: string;
  totalKg: number;
  activatedAt?: string | null;
}

export interface CollectorProfile {
  id: string;
  cooperativeId?: string | null;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  rg?: string | null;
  birthDate?: string | null;
  status: "AVAILABLE" | "ON_ROUTE" | "INACTIVE";
  kgMonth: number;
  collectionsToday: number;
  totalKg: number;
}

export interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  accountStatus: string;
  isActive: boolean;
  phone?: string | null;
  rememberMe?: boolean;
  personProfile?: PersonProfile | null;
  generator?: GeneratorProfile | null;
  collector?: CollectorProfile | null;
  createdAt?: string;
  updatedAt?: string;
}
