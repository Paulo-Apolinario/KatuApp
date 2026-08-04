import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ZodError } from "zod";

import {
  createScheduleSchema,
  scheduleIdParamsSchema,
  updateScheduleStatusSchema,
} from "./schedule.schemas";

import { ScheduleService } from "./schedule.service";

const scheduleService =
  new ScheduleService();

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

type AuthenticatedScheduleUser = {
  sub?: string;
  id?: string;
  userId?: string;
  role?: string;
};

function getZodErrorMessage(
  error: ZodError,
  fallbackMessage: string
) {
  return (
    error.issues[0]?.message ||
    fallbackMessage
  );
}

function getZodFieldErrors(
  error: ZodError
) {
  return error.flatten().fieldErrors;
}

function getAuthenticatedUser(
  request: FastifyRequest
) {
  const authUser =
    request.user as AuthenticatedScheduleUser;

  const userId =
    authUser?.sub ||
    authUser?.id ||
    authUser?.userId;

  const role = String(
    authUser?.role || ""
  )
    .trim()
    .toUpperCase();

  if (!userId) {
    throw new Error(
      "Usuário autenticado não identificado."
    );
  }

  if (!role) {
    throw new Error(
      "Perfil do usuário autenticado não identificado."
    );
  }

  return {
    userId,
    role,
  };
}

function resolveScheduleErrorStatus(
  message: string
) {
  const normalized =
    message.toLocaleLowerCase(
      "pt-BR"
    );

  if (
    normalized.includes(
      "usuário autenticado não identificado"
    ) ||
    normalized.includes(
      "perfil do usuário autenticado não identificado"
    )
  ) {
    return 401;
  }

  if (
    normalized.includes(
      "sem permissão"
    ) ||
    normalized.includes(
      "apenas cooperativas"
    ) ||
    normalized.includes(
      "deve ser atualizado pelo fluxo operacional"
    )
  ) {
    return 403;
  }

  if (
    normalized.includes(
      "não encontrado"
    ) ||
    normalized.includes(
      "não encontrada"
    )
  ) {
    return 404;
  }

  if (
    normalized.includes(
      "não é possível cancelar"
    ) ||
    normalized.includes(
      "já possui"
    ) ||
    normalized.includes(
      "já está encerrado"
    ) ||
    normalized.includes(
      "somente agendamentos solicitados"
    )
  ) {
    return 409;
  }

  return 400;
}

function sendScheduleError(
  reply: FastifyReply,
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,

      error: getZodErrorMessage(
        error,
        fallbackMessage
      ),

      code:
        "VALIDATION_ERROR",

      errors:
        getZodFieldErrors(error),
    });
  }

  if (error instanceof Error) {
    const statusCode =
      resolveScheduleErrorStatus(
        error.message
      );

    return reply
      .status(statusCode)
      .send({
        success: false,

        error:
          error.message ||
          fallbackMessage,

        code:
          statusCode === 401
            ? "AUTHENTICATION_ERROR"
            : statusCode === 403
              ? "AUTHORIZATION_ERROR"
              : statusCode === 404
                ? "NOT_FOUND"
                : statusCode === 409
                  ? "CONFLICT"
                  : "SCHEDULE_ERROR",
      });
  }

  return reply.status(500).send({
    success: false,

    error:
      fallbackMessage,

    code:
      "INTERNAL_SERVER_ERROR",
  });
}

/*
 * ============================================================
 * CONTROLLER
 * ============================================================
 */

export class ScheduleController {
  async create(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(
          request
        );

      const body =
        createScheduleSchema.parse(
          request.body
        );

      const schedule =
        await scheduleService.create(
          authUser.userId,
          authUser.role,
          body
        );

      return reply.status(201).send({
        success: true,

        message:
          "Solicitação de coleta criada com sucesso.",

        schedule,
      });
    } catch (error: unknown) {
      request.log.error(
        {
          error,
        },
        "Erro ao criar agendamento."
      );

      return sendScheduleError(
        reply,
        error,
        "Erro ao criar agendamento."
      );
    }
  }

  async listMine(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(
          request
        );

      const schedules =
        await scheduleService.listMine(
          authUser.userId,
          authUser.role
        );

      return reply.send({
        success: true,

        schedules,

        total:
          schedules.length,
      });
    } catch (error: unknown) {
      request.log.error(
        {
          error,
        },
        "Erro ao listar agendamentos."
      );

      return sendScheduleError(
        reply,
        error,
        "Erro ao listar agendamentos."
      );
    }
  }

  async findById(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(
          request
        );

      const params =
        scheduleIdParamsSchema.parse(
          request.params
        );

      const schedule =
        await scheduleService.findById(
          authUser.userId,
          authUser.role,
          params.id
        );

      return reply.send({
        success: true,

        schedule,
      });
    } catch (error: unknown) {
      request.log.error(
        {
          error,
        },
        "Erro ao buscar agendamento."
      );

      return sendScheduleError(
        reply,
        error,
        "Erro ao buscar agendamento."
      );
    }
  }

  async updateStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(
          request
        );

      if (
        authUser.role !==
        "COOPERATIVE"
      ) {
        return reply
          .status(403)
          .send({
            success: false,

            error:
              "Apenas cooperativas podem atualizar agendamentos.",

            code:
              "ONLY_COOPERATIVE_CAN_UPDATE_SCHEDULE",
          });
      }

      const params =
        scheduleIdParamsSchema.parse(
          request.params
        );

      const body =
        updateScheduleStatusSchema.parse(
          request.body
        );

      const schedule =
        await scheduleService.updateStatus(
          authUser.userId,
          params.id,
          body
        );

      const message =
        body.status ===
          "SCHEDULED"
          ? "Agendamento confirmado com sucesso."
          : "Agendamento cancelado com sucesso.";

      return reply.send({
        success: true,

        message,

        schedule,
      });
    } catch (error: unknown) {
      request.log.error(
        {
          error,
        },
        "Erro ao atualizar status do agendamento."
      );

      return sendScheduleError(
        reply,
        error,
        "Erro ao atualizar status do agendamento."
      );
    }
  }
}
