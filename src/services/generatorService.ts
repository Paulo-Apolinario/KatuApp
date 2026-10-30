import { api } from "./api";

export type GeneratorType = "SMALL" | "LARGE";

export type GeneratorAccessStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "INACTIVE"
  | "BLOCKED";

export interface Generator {
  id: string;
  cooperativeId: string;
  userId?: string | null;
  type: GeneratorType;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;

  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  status?: string | null;
  accessReleased: boolean;
  accessStatus: GeneratorAccessStatus;
  totalKg: number;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string | null;
}

export interface CreateGeneratorDTO {
  type: GeneratorType;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;

  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  address?: string;

  latitude?: number;
  longitude?: number;

  status?: string;
}

type CreateGeneratorResponse = {
  success: boolean;
  generator: Generator;
  temporaryPassword?: string;
};

type ListGeneratorsResponse = {
  success: boolean;
  generators: Generator[];
};

type FindGeneratorByIdResponse = {
  success: boolean;
  generator: Generator;
};

function sanitizeCreatePayload(data: CreateGeneratorDTO): CreateGeneratorDTO {
  return {
    type: data.type,
    name: data.name.trim(),
    companyName: data.companyName?.trim() || undefined,
    email: data.email.trim().toLowerCase(),
    phone: data.phone?.trim() || undefined,

    zipCode: data.zipCode?.trim() || undefined,
    street: data.street?.trim() || undefined,
    number: data.number?.trim() || undefined,
    neighborhood: data.neighborhood?.trim() || undefined,
    city: data.city?.trim() || undefined,
    state: data.state?.trim() || undefined,
    address: data.address?.trim() || undefined,

    latitude:
      typeof data.latitude === "number" && Number.isFinite(data.latitude)
        ? data.latitude
        : undefined,
    longitude:
      typeof data.longitude === "number" && Number.isFinite(data.longitude)
        ? data.longitude
        : undefined,

    status: data.status?.trim() || undefined,
  };
}

async function createGenerator(data: CreateGeneratorDTO) {
  const payload = sanitizeCreatePayload(data);
  return api.post<CreateGeneratorResponse>("/generators", payload, true);
}

async function listMine() {
  const response = await api.get<ListGeneratorsResponse>("/generators", true);
  return response.generators ?? [];
}

async function list() {
  return listMine();
}

async function findById(id: string) {
  const response = await api.get<FindGeneratorByIdResponse>(
    `/generators/${id}`,
    true
  );
  return response.generator;
}

async function getGeneratorById(id: string) {
  return findById(id);
}

export const generatorService = {
  createGenerator,
  listMine,
  list,
  findById,
  getGeneratorById,
};

export default generatorService;