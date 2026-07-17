import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ZodError } from "zod";

import {
  cancelWasteDestinationBodySchema,
  collectionWasteEntryIdParamsSchema,
  createWasteDestinationBodySchema,
  entryWasteDestinationListQuerySchema,
  updateWasteDestinationBodySchema,
  wasteDestinationIdParamsSchema,
  wasteDestinationListQuerySchema,
} from "./collection-waste-destinations.schemas";

import { CollectionWasteDestinationsService } from "./collection-waste-destinations.service";

import {
  isWasteDestinationDomainError,
  type WasteDestinationAuthenticatedUser,
} from "./collection-waste-destinations.types";

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

const collectionWasteDestinationsService =
  new CollectionWasteDestinationsService();

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

/**
 * Retorna a primeira mensagem produzida pelo Zod.
 */
function getZodErrorMessage(
  error: ZodError,
  fallbackMessage: string
) {
  return (
    error.issues[0]?.message ||
    fallbackMessage
  );
}

/**
 * Retorna os erros organizados por campo.
 */
function getZodFieldErrors(
  error: ZodError
) {
  return error.flatten().fieldErrors;
}

/**
 * Extrai os dados do usuário autenticado pelo JWT.
 *
 * Estrutura esperada:
 *
 * {
 *   sub: "user-id",
 *   role: "COOPERATIVE"
 * }
 */
function getAuthenticatedUser(
  request: FastifyRequest
): WasteDestinationAuthenticatedUser {
  const authUser =
    request.user as Partial<WasteDestinationAuthenticatedUser>;

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
    sub: userId,
    role,
    id: authUser.id,
    userId: authUser.userId,
  };
}

/**
 * Padroniza os erros do módulo.
 */
function sendWasteDestinationError(
  reply: FastifyReply,
  error: unknown,
  fallbackMessage: string
) {
  /*
   * ============================================================
   * ERROS DO ZOD
   * ============================================================
   */

  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,

      error: getZodErrorMessage(
        error,
        fallbackMessage
      ),

      code: "VALIDATION_ERROR",

      errors: getZodFieldErrors(error),
    });
  }

  /*
   * ============================================================
   * ERROS DE DOMÍNIO
   * ============================================================
   */

  if (
    isWasteDestinationDomainError(
      error
    )
  ) {
    return reply
      .status(error.statusCode)
      .send({
        success: false,

        error: error.message,

        code: error.code,

        details: error.details,
      });
  }

  /*
   * ============================================================
   * ERROS GERAIS
   * ============================================================
   */

  if (error instanceof Error) {
    const authenticationMessages = [
      "Usuário autenticado não identificado.",
      "Perfil do usuário autenticado não identificado.",
    ];

    const isAuthenticationError =
      authenticationMessages.includes(
        error.message
      );

    return reply
      .status(
        isAuthenticationError
          ? 401
          : 500
      )
      .send({
        success: false,

        error:
          error.message ||
          fallbackMessage,

        code:
          isAuthenticationError
            ? "AUTHENTICATION_ERROR"
            : "WASTE_DESTINATION_ERROR",
      });
  }

  /*
   * ============================================================
   * ERRO DESCONHECIDO
   * ============================================================
   */

  return reply.status(500).send({
    success: false,

    error: fallbackMessage,

    code: "INTERNAL_SERVER_ERROR",
  });
}

/*
 * ============================================================
 * CONTROLLER
 * ============================================================
 */

export class CollectionWasteDestinationsController {
  /*
   * ============================================================
   * CRIAR DESTINAÇÃO
   * ============================================================
   *
   * POST /collection-waste-destinations
   */

  async create(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const body =
        createWasteDestinationBodySchema.parse(
          request.body
        );

      const result =
        await collectionWasteDestinationsService.create(
          authUser.sub,
          authUser.role,
          body
        );

      return reply.status(201).send(
        result
      );
    } catch (error: unknown) {
      request.log.error(
        {
          error,
          body: request.body,
        },
        "Erro ao registrar destinação de resíduo."
      );

      return sendWasteDestinationError(
        reply,
        error,
        "Erro ao registrar destinação de resíduo."
      );
    }
  }

  /*
   * ============================================================
   * LISTAGEM GERAL
   * ============================================================
   *
   * GET /collection-waste-destinations
   */

  async list(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const query =
        wasteDestinationListQuerySchema.parse(
          request.query
        );

      const result =
        await collectionWasteDestinationsService.list(
          authUser.sub,
          authUser.role,
          query
        );

      return reply.status(200).send(
        result
      );
    } catch (error: unknown) {
      request.log.error(
        {
          error,
          query: request.query,
        },
        "Erro ao listar destinações de resíduos."
      );

      return sendWasteDestinationError(
        reply,
        error,
        "Erro ao listar destinações de resíduos."
      );
    }
  }

  /*
   * ============================================================
   * LISTAGEM POR ENTRADA
   * ============================================================
   *
   * GET /collection-waste-destinations/entry/:entryId
   */

  async listByEntry(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const params =
        collectionWasteEntryIdParamsSchema.parse(
          request.params
        );

      const query =
        entryWasteDestinationListQuerySchema.parse(
          request.query
        );

      const result =
        await collectionWasteDestinationsService.listByEntry(
          authUser.sub,
          authUser.role,
          params.entryId,
          query
        );

      return reply.status(200).send(
        result
      );
    } catch (error: unknown) {
      request.log.error(
        {
          error,
          params: request.params,
          query: request.query,
        },
        "Erro ao listar destinações da entrada de resíduo."
      );

      return sendWasteDestinationError(
        reply,
        error,
        "Erro ao listar destinações da entrada de resíduo."
      );
    }
  }

  /*
   * ============================================================
   * CONSULTAR POR ID
   * ============================================================
   *
   * GET /collection-waste-destinations/:id
   */

  async findById(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const params =
        wasteDestinationIdParamsSchema.parse(
          request.params
        );

      const result =
        await collectionWasteDestinationsService.findById(
          authUser.sub,
          authUser.role,
          params.id
        );

      return reply.status(200).send(
        result
      );
    } catch (error: unknown) {
      request.log.error(
        {
          error,
          params: request.params,
        },
        "Erro ao buscar destinação de resíduo."
      );

      return sendWasteDestinationError(
        reply,
        error,
        "Erro ao buscar destinação de resíduo."
      );
    }
  }

  /*
   * ============================================================
   * ATUALIZAR DADOS COMPLEMENTARES
   * ============================================================
   *
   * PATCH /collection-waste-destinations/:id
   */

  async update(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const params =
        wasteDestinationIdParamsSchema.parse(
          request.params
        );

      const body =
        updateWasteDestinationBodySchema.parse(
          request.body
        );

      const result =
        await collectionWasteDestinationsService.update(
          authUser.sub,
          authUser.role,
          params.id,
          body
        );

      return reply.status(200).send(
        result
      );
    } catch (error: unknown) {
      request.log.error(
        {
          error,
          params: request.params,
          body: request.body,
        },
        "Erro ao atualizar destinação de resíduo."
      );

      return sendWasteDestinationError(
        reply,
        error,
        "Erro ao atualizar destinação de resíduo."
      );
    }
  }

  /*
   * ============================================================
   * CANCELAR DESTINAÇÃO
   * ============================================================
   *
   * POST /collection-waste-destinations/:id/cancel
   */

  async cancel(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const params =
        wasteDestinationIdParamsSchema.parse(
          request.params
        );

      const body =
        cancelWasteDestinationBodySchema.parse(
          request.body
        );

      const result =
        await collectionWasteDestinationsService.cancel(
          authUser.sub,
          authUser.role,
          params.id,
          body
        );

      return reply.status(200).send(
        result
      );
    } catch (error: unknown) {
      request.log.error(
        {
          error,
          params: request.params,
          body: request.body,
        },
        "Erro ao cancelar destinação de resíduo."
      );

      return sendWasteDestinationError(
        reply,
        error,
        "Erro ao cancelar destinação de resíduo."
      );
    }
  }
}