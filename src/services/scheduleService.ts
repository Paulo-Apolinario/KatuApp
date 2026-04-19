import { api, isApiNetworkError } from "./api";
import {
  getAllSchedules,
  getScheduleById,
  upsertSchedules,
} from "../database/repositories/scheduleRepository";

export type ScheduleStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type CollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface ScheduleCollectionMaterial {
  type: string;
  quantityKg: number;
}

export interface ScheduleCollector {
  id: string;
  name?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  cpf?: string | null;
  address?: string | null;
}

export interface ScheduleDriver {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  status?: string | null;
}

export interface ScheduleVehicle {
  id: string;
  model?: string | null;
  plate?: string | null;
  brand?: string | null;
  type?: string | null;
  status?: string | null;
}

export interface ScheduleRoute {
  id: string;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  scheduledDate?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface ScheduleCollection {
  id: string;
  cooperativeId?: string | null;
  generatorId?: string | null;
  collectorId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
  scheduleId?: string | null;
  collectedAt?: string | null;
  totalWeightKg?: number | null;
  materials?: ScheduleCollectionMaterial[];
  notes?: string | null;
  status: CollectionStatus;
  createdAt?: string;
  updatedAt?: string;
  collector?: ScheduleCollector | null;
  driver?: ScheduleDriver | null;
  vehicle?: ScheduleVehicle | null;
  route?: ScheduleRoute | null;
}

export interface Schedule {
  id: string;
  cooperativeId: string;
  generatorId?: string | null;
  requestedByUserId?: string | null;
  preferredDate?: string | null;
  scheduledDate?: string | null;
  status: ScheduleStatus;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  generator?: {
    id: string;
    name?: string | null;
    businessName?: string | null;
    companyName?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  cooperative?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  requestedBy?: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  collections?: ScheduleCollection[];
}

export interface CreateSchedulePayload {
  cooperativeId: string;
  generatorId?: string;
  preferredDate?: string;
  scheduledDate?: string;
  requestedMaterials: string[];
  notes?: string;
}

export interface UpdateScheduleStatusPayload {
  status: ScheduleStatus;
}

type ListSchedulesApiResponse =
  | Schedule[]
  | {
      schedules?: Schedule[];
      success?: boolean;
    };

type CreateScheduleApiResponse = {
  schedule?: Schedule;
  success?: boolean;
};

type UpdateScheduleStatusApiResponse = {
  schedule?: Schedule;
  success?: boolean;
};

function normalizeMaterials(materials: unknown): ScheduleCollectionMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const material = item as {
        type?: unknown;
        quantityKg?: unknown;
      };

      return {
        type: String(material.type ?? "").trim(),
        quantityKg: Number(material.quantityKg ?? 0),
      };
    })
    .filter(
      (item): item is ScheduleCollectionMaterial =>
        !!item && item.type.length > 0
    );
}

function normalizeCollection(collection: ScheduleCollection): ScheduleCollection {
  return {
    ...collection,
    totalWeightKg: Number(collection.totalWeightKg ?? 0),
    materials: normalizeMaterials(collection.materials),
  };
}

function normalizeSchedule(schedule: Schedule): Schedule {
  return {
    ...schedule,
    generator: schedule.generator
      ? {
          ...schedule.generator,
          latitude:
            typeof schedule.generator.latitude === "number"
              ? schedule.generator.latitude
              : schedule.generator.latitude != null
              ? Number(schedule.generator.latitude)
              : null,
          longitude:
            typeof schedule.generator.longitude === "number"
              ? schedule.generator.longitude
              : schedule.generator.longitude != null
              ? Number(schedule.generator.longitude)
              : null,
        }
      : null,
    collections: Array.isArray(schedule.collections)
      ? schedule.collections.map(normalizeCollection)
      : [],
  };
}

async function saveSchedulesToCache(schedules: Schedule[]) {
  await upsertSchedules(
    schedules.map((schedule) => ({
      id: schedule.id,
      status: schedule.status,
      generatorId: schedule.generatorId ?? schedule.generator?.id ?? null,
      payload: schedule,
      updatedAt: schedule.updatedAt ?? null,
    }))
  );
}

async function readSchedulesFromCache(): Promise<Schedule[]> {
  const rows = await getAllSchedules();

  return rows
    .map((row) => row?.payload)
    .filter((item): item is Schedule => !!item)
    .map(normalizeSchedule);
}

async function readScheduleByIdFromCache(id: string): Promise<Schedule | null> {
  const row = await getScheduleById(id);

  if (!row?.payload) return null;

  return normalizeSchedule(row.payload as Schedule);
}

async function list(): Promise<Schedule[]> {
  try {
    const response = await api.get<ListSchedulesApiResponse>("/schedules", true);

    const schedules = Array.isArray(response)
      ? response
      : Array.isArray(response?.schedules)
      ? response.schedules
      : [];

    const normalized = schedules.map(normalizeSchedule);
    await saveSchedulesToCache(normalized);

    return normalized;
  } catch (error) {
    if (isApiNetworkError(error)) {
      return readSchedulesFromCache();
    }

    throw error;
  }
}

async function getById(id: string): Promise<Schedule> {
  try {
    const schedules = await list();
    const found = schedules.find((item) => item.id === id);

    if (found) return found;

    throw new Error("Agendamento não encontrado.");
  } catch (error) {
    if (isApiNetworkError(error)) {
      const cached = await readScheduleByIdFromCache(id);

      if (cached) return cached;
    }

    throw error;
  }
}

async function create(payload: CreateSchedulePayload): Promise<Schedule> {
  const response = await api.post<CreateScheduleApiResponse>(
    "/schedules",
    {
      cooperativeId: payload.cooperativeId,
      generatorId: payload.generatorId || undefined,
      preferredDate: payload.preferredDate || undefined,
      scheduledDate: payload.scheduledDate || undefined,
      requestedMaterials: payload.requestedMaterials,
      notes: payload.notes?.trim() || undefined,
    },
    true
  );

  if (!response?.schedule) {
    throw new Error("Agendamento não retornado pela API.");
  }

  const normalized = normalizeSchedule(response.schedule);
  await saveSchedulesToCache([normalized]);

  return normalized;
}

async function updateStatus(
  id: string,
  payload: UpdateScheduleStatusPayload
): Promise<Schedule> {
  const response = await api.patch<UpdateScheduleStatusApiResponse>(
    `/schedules/${id}/status`,
    {
      status: payload.status,
    },
    true
  );

  if (!response?.schedule) {
    throw new Error("Agendamento não retornado pela API.");
  }

  const normalized = normalizeSchedule(response.schedule);
  await saveSchedulesToCache([normalized]);

  return normalized;
}

export const scheduleService = {
  list,
  getById,
  create,
  updateStatus,
};

export default scheduleService;