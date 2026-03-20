import { api } from "./api";

  export type GeneratorAccessStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "INACTIVE"
  | "BLOCKED";

  export type GeneratorType = "SMALL" | "LARGE";

  export interface Generator {
  id: string;
  cooperativeId: string;
  userId?: string | null;
  type: GeneratorType;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  status?: string | null;
  accessReleased?: boolean;
  accessStatus: GeneratorAccessStatus;
  totalKg?: number;
  createdAt?: string;
  updatedAt?: string;
  activatedAt?: string | null;
}

export interface CreateGeneratorDTO {
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  address?: string;
  type: "SMALL" | "LARGE";
}

type ListGeneratorsApiResponse =
  | Generator[]
  | {
      generators?: Generator[];
    };

type GetGeneratorByIdResponse = {
  generator: Generator;
};

type CreateGeneratorResponse = {
  generator: Generator;
  temporaryPassword?: string;
  message?: string;
};

async function list(): Promise<Generator[]> {
  const response = await api.get<ListGeneratorsApiResponse>("/generators", true);

  if (Array.isArray(response)) {
    return response;
  }

  return response.generators ?? [];
}

async function getGeneratorById(id: string) {
  return api.get<GetGeneratorByIdResponse>(`/generators/${id}`, true);
}

async function createGenerator(data: CreateGeneratorDTO) {
  return api.post<CreateGeneratorResponse>("/generators", data, true);
}

export const generatorService = {
  list,
  getGeneratorById,
  createGenerator,
};