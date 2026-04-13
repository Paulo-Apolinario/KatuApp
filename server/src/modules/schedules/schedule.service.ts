import {
  AccountStatus,
  CollectionStatus,
  ScheduleStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  CreateScheduleInput,
  UpdateScheduleStatusInput,
} from "./schedule.schemas";

function isGeneratorRole(role: string) {
  return (
    role === UserRole.GENERATOR_SMALL || role === UserRole.GENERATOR_LARGE
  );
}

function buildScheduleNotes(
  requestedMaterials: string[] = [],
  notes?: string
): string | null {
  const materialsText = requestedMaterials.length
    ? `Materiais solicitados: ${requestedMaterials.join(", ")}`
    : "";

  const extraNotes = notes?.trim() || "";
  const combined = [materialsText, extraNotes].filter(Boolean).join(" | ");

  return combined || null;
}

function resolveInitialStatus(data: CreateScheduleInput) {
  return data.scheduledDate
    ? ScheduleStatus.SCHEDULED
    : ScheduleStatus.REQUESTED;
}

function normalizeDate(date?: string | null) {
  if (!date) return null;
  return new Date(date);
}

const userSelect = {
  id: true,
  displayName: true,
  email: true,
  role: true,
  phone: true,
  isActive: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

const cooperativeSelect = {
  id: true,
  name: true,
  registrationNumber: true,
  email: true,
  phone: true,
  address: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const generatorSelect = {
  id: true,
  name: true,
  companyName: true,
  email: true,
  phone: true,
  zipCode: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
  address: true,
  latitude: true,
  longitude: true,
  type: true,
  accessReleased: true,
  accessStatus: true,
  totalKg: true,
  userId: true,
  cooperativeId: true,
} as const;

const collectorSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  rg: true,
  birthDate: true,
  status: true,
  kgMonth: true,
  collectionsToday: true,
  totalKg: true,
} as const;

const driverSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  cpf: true,
  cnh: true,
  cnhCategory: true,
  status: true,
} as const;

const vehicleSelect = {
  id: true,
  plate: true,
  model: true,
  brand: true,
  year: true,
  capacityKg: true,
  status: true,
} as const;

const routeSelect = {
  id: true,
  name: true,
  description: true,
  scheduledDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const scheduleInclude = {
  generator: {
    select: generatorSelect,
  },
  cooperative: {
    select: cooperativeSelect,
  },
  requestedBy: {
    select: userSelect,
  },
  collections: {
    include: {
      collector: {
        select: collectorSelect,
      },
      driver: {
        select: driverSelect,
      },
      vehicle: {
        select: vehicleSelect,
      },
      route: {
        select: routeSelect,
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
} as const;

export class ScheduleService {
  async create(
    authUserId: string,
    authUserRole: string,
    data: CreateScheduleInput
  ) {
    if (authUserRole === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
      });

      if (!cooperative) {
        throw new Error("Cooperativa do usuário autenticado não encontrada.");
      }

      if (!data.generatorId) {
        throw new Error("Gerador é obrigatório.");
      }

      const generator = await prisma.generator.findFirst({
        where: {
          id: data.generatorId,
          cooperativeId: cooperative.id,
        },
      });

      if (!generator) {
        throw new Error("Gerador não encontrado para esta cooperativa.");
      }

      return prisma.schedule.create({
        data: {
          cooperativeId: cooperative.id,
          generatorId: generator.id,
          requestedByUserId: authUserId,
          preferredDate: normalizeDate(data.preferredDate),
          scheduledDate: normalizeDate(data.scheduledDate),
          notes: buildScheduleNotes(data.requestedMaterials, data.notes),
          status: resolveInitialStatus(data),
        },
        include: scheduleInclude,
      });
    }

    if (isGeneratorRole(authUserRole)) {
      const generator = await prisma.generator.findUnique({
        where: { userId: authUserId },
      });

      if (!generator) {
        throw new Error("Gerador do usuário autenticado não encontrado.");
      }

      return prisma.schedule.create({
        data: {
          cooperativeId: generator.cooperativeId,
          generatorId: generator.id,
          requestedByUserId: authUserId,
          preferredDate: normalizeDate(data.preferredDate),
          scheduledDate: normalizeDate(data.scheduledDate),
          notes: buildScheduleNotes(data.requestedMaterials, data.notes),
          status: resolveInitialStatus(data),
        },
        include: scheduleInclude,
      });
    }

    if (authUserRole === UserRole.PF) {
      if (!data.cooperativeId) {
        throw new Error("Cooperativa é obrigatória para agendamento PF.");
      }

      const cooperative = await prisma.cooperative.findFirst({
        where: {
          id: data.cooperativeId,
          user: {
            role: UserRole.COOPERATIVE,
            isActive: true,
            accountStatus: AccountStatus.ACTIVE,
          },
        },
      });

      if (!cooperative) {
        throw new Error("Cooperativa não encontrada ou inativa.");
      }

      return prisma.schedule.create({
        data: {
          cooperativeId: cooperative.id,
          requestedByUserId: authUserId,
          preferredDate: normalizeDate(data.preferredDate),
          scheduledDate: normalizeDate(data.scheduledDate),
          notes: buildScheduleNotes(data.requestedMaterials, data.notes),
          status: resolveInitialStatus(data),
        },
        include: scheduleInclude,
      });
    }

    throw new Error("Usuário sem permissão para criar agendamentos.");
  }

  async listMine(authUserId: string, authUserRole: string) {
    if (authUserRole === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
      });

      if (!cooperative) {
        throw new Error("Cooperativa do usuário autenticado não encontrada.");
      }

      return prisma.schedule.findMany({
        where: {
          cooperativeId: cooperative.id,
        },
        include: scheduleInclude,
        orderBy: [
          { status: "asc" },
          { scheduledDate: "asc" },
          { preferredDate: "asc" },
          { createdAt: "desc" },
        ],
      });
    }

    if (isGeneratorRole(authUserRole)) {
      const generator = await prisma.generator.findUnique({
        where: { userId: authUserId },
      });

      if (!generator) {
        throw new Error("Gerador do usuário autenticado não encontrado.");
      }

      return prisma.schedule.findMany({
        where: {
          generatorId: generator.id,
        },
        include: scheduleInclude,
        orderBy: [
          { status: "asc" },
          { scheduledDate: "asc" },
          { preferredDate: "asc" },
          { createdAt: "desc" },
        ],
      });
    }

    if (authUserRole === UserRole.PF) {
      return prisma.schedule.findMany({
        where: {
          requestedByUserId: authUserId,
        },
        include: scheduleInclude,
        orderBy: [
          { status: "asc" },
          { scheduledDate: "asc" },
          { preferredDate: "asc" },
          { createdAt: "desc" },
        ],
      });
    }

    throw new Error("Usuário sem permissão para listar agendamentos.");
  }

  async findById(authUserId: string, authUserRole: string, scheduleId: string) {
    if (authUserRole === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
      });

      if (!cooperative) {
        throw new Error("Cooperativa do usuário autenticado não encontrada.");
      }

      const schedule = await prisma.schedule.findFirst({
        where: {
          id: scheduleId,
          cooperativeId: cooperative.id,
        },
        include: scheduleInclude,
      });

      if (!schedule) {
        throw new Error("Agendamento não encontrado.");
      }

      return schedule;
    }

    if (isGeneratorRole(authUserRole)) {
      const generator = await prisma.generator.findUnique({
        where: { userId: authUserId },
      });

      if (!generator) {
        throw new Error("Gerador do usuário autenticado não encontrado.");
      }

      const schedule = await prisma.schedule.findFirst({
        where: {
          id: scheduleId,
          generatorId: generator.id,
        },
        include: scheduleInclude,
      });

      if (!schedule) {
        throw new Error("Agendamento não encontrado.");
      }

      return schedule;
    }

    if (authUserRole === UserRole.PF) {
      const schedule = await prisma.schedule.findFirst({
        where: {
          id: scheduleId,
          requestedByUserId: authUserId,
        },
        include: scheduleInclude,
      });

      if (!schedule) {
        throw new Error("Agendamento não encontrado.");
      }

      return schedule;
    }

    throw new Error("Usuário sem permissão para consultar agendamentos.");
  }

  async updateStatus(
    cooperativeUserId: string,
    scheduleId: string,
    data: UpdateScheduleStatusInput
  ) {
    const cooperative = await prisma.cooperative.findUnique({
      where: { userId: cooperativeUserId },
    });

    if (!cooperative) {
      throw new Error("Cooperativa do usuário autenticado não encontrada.");
    }

    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        cooperativeId: cooperative.id,
      },
      include: {
        collections: {
          where: {
            status: {
              in: [CollectionStatus.PENDING, CollectionStatus.IN_PROGRESS],
            },
          },
        },
      },
    });

    if (!existingSchedule) {
      throw new Error("Agendamento não encontrado.");
    }

    if (
      data.status === ScheduleStatus.CANCELLED &&
      existingSchedule.collections.length > 0
    ) {
      throw new Error(
        "Não é possível cancelar um agendamento com coleta operacional ativa."
      );
    }

    return prisma.schedule.update({
      where: { id: existingSchedule.id },
      data: {
        status: data.status,
      },
      include: scheduleInclude,
    });
  }
}