import { api } from "./api";

export type ScheduleStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

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
    companyName?: string | null;
    address?: string | null;
  } | null;

  cooperative?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;

  // 🔥 NOVO: quem solicitou (PF ou usuário gerador)
  requestedBy?: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
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

async function list(): Promise<Schedule[]> {
  const response = await api.get<ListSchedulesApiResponse>(
    "/schedules",
    true
  );

  if (Array.isArray(response)) {
    return response;
  }

  return response.schedules ?? [];
}

async function create(payload: CreateSchedulePayload): Promise<Schedule> {
  const response = await api.post<CreateScheduleApiResponse>(
    "/schedules",
    payload,
    true
  );

  if (!response.schedule) {
    throw new Error("Agendamento não retornado pela API.");
  }

  return response.schedule;
}

async function updateStatus(
  id: string,
  payload: UpdateScheduleStatusPayload
): Promise<Schedule> {
  const response = await api.patch<UpdateScheduleStatusApiResponse>(
    `/schedules/${id}/status`,
    payload,
    true
  );

  if (!response.schedule) {
    throw new Error("Agendamento não retornado pela API.");
  }

  return response.schedule;
}

export const scheduleService = {
  list,
  create,
  updateStatus,
};

export default scheduleService;