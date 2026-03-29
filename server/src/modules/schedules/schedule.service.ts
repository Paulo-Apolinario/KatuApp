import { AccountStatus, ScheduleStatus, UserRole } from "@prisma/client";
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
  requestedMaterials: string[],
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

const scheduleInclude = {
  generator: true,
  cooperative: true,
  requestedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
  collections: {
    include: {
      collector: true,
      driver: true,
      vehicle: true,
      route: true,
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
};

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
          preferredDate: data.preferredDate
            ? new Date(data.preferredDate)
            : null,
          scheduledDate: data.scheduledDate
            ? new Date(data.scheduledDate)
            : null,
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
          preferredDate: data.preferredDate
            ? new Date(data.preferredDate)
            : null,
          scheduledDate: data.scheduledDate
            ? new Date(data.scheduledDate)
            : null,
          notes: buildScheduleNotes(data.requestedMaterials, data.notes),
          status: resolveInitialStatus(data),
        },
        include: scheduleInclude,
      });
    }

    if (authUserRole === UserRole.PF) {
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
          preferredDate: data.preferredDate
            ? new Date(data.preferredDate)
            : null,
          scheduledDate: data.scheduledDate
            ? new Date(data.scheduledDate)
            : null,
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
              in: ["PENDING", "IN_PROGRESS"],
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