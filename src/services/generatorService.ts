import { api } from "./api";

export type GeneratorType = "SMALL" | "LARGE";

export type GeneratorAccessStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "INACTIVE"
  | "BLOCKED";

export interface Generator {
  generator: any;
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

async function createGenerator(data: CreateGeneratorDTO) {
  return api.post<CreateGeneratorResponse>("/generators", data, true);
}

async function listMine() {
  const response = await api.get<ListGeneratorsResponse>("/generators", true);
  return response.generators ?? [];
}

// compatibilidade com telas antigas
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

// compatibilidade com telas antigas
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