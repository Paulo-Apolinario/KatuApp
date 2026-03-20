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
  generatorId: string;
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
}

export interface CreateSchedulePayload {
  preferredDate?: string;
  scheduledDate?: string;
  notes?: string;
}

type ListSchedulesApiResponse =
  | Schedule[]
  | {
      schedules?: Schedule[];
    };

type CreateScheduleApiResponse = {
  schedule?: Schedule;
};

async function list(): Promise<Schedule[]> {
  const response = await api.get<ListSchedulesApiResponse>("/schedules", true);

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

export const scheduleService = {
  list,
  create,
};

export default scheduleService;