import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ZodError } from "zod";

import {
  collectionEntryIdParamsSchema,
  collectionEntryListQuerySchema,
  collectionEntrySummaryQuerySchema,
  pendingCollectionEntryQuerySchema,
} from "./collection-entries.schemas";

import { CollectionEntriesService } from "./collection-entries.service";

import {
  isCollectionEntryDomainError,
  type CollectionEntryAuthenticatedUser,
} from "./collection-entries.types";

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

const collectionEntriesService =
  new CollectionEntriesService();

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

/**
 * Retorna a primeira mensagem de validação produzida pelo Zod.
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
 * Organiza os erros de validação por campo.
 */
function getZodFieldErrors(
  error: ZodError
) {
  return error.flatten().fieldErrors;
}

/**
 * Extrai o usuário autenticado do JWT.
 *
 * Estrutura esperada:
 *
 * {
 *   sub: "id-do-usuario",
 *   role: "COOPERATIVE"
 * }
 */
function getAuthenticatedUser(
  request: FastifyRequest
): CollectionEntryAuthenticatedUser {
  const authUser =
    request.user as Partial<CollectionEntryAuthenticatedUser>;

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
 * Padroniza os erros retornados pelo módulo.
 */
function sendCollectionEntryError(
  reply: FastifyReply,
  error: unknown,
  fallbackMessage: string
) {
  /*
   * ============================================================
   * ERROS DE VALIDAÇÃO
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
    isCollectionEntryDomainError(
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
            : "COLLECTION_ENTRY_ERROR",
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

export class CollectionEntriesController {
  /*
   * ============================================================
   * LISTAGEM GERAL
   * ============================================================
   *
   * GET /collection-entries
   */

  async list(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const query =
        collectionEntryListQuerySchema.parse(
          request.query
        );

      const result =
        await collectionEntriesService.list(
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
        "Erro ao listar entradas de resíduos coletados."
      );

      return sendCollectionEntryError(
        reply,
        error,
        "Erro ao listar entradas de resíduos coletados."
      );
    }
  }

  /*
   * ============================================================
   * LISTAGEM DE ENTRADAS PENDENTES
   * ============================================================
   *
   * GET /collection-entries/pending
   */

  async listPending(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const query =
        pendingCollectionEntryQuerySchema.parse(
          request.query
        );

      const result =
        await collectionEntriesService.listPending(
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
        "Erro ao listar entradas pendentes de destinação."
      );

      return sendCollectionEntryError(
        reply,
        error,
        "Erro ao listar entradas pendentes de destinação."
      );
    }
  }

  /*
   * ============================================================
   * RESUMO OPERACIONAL
   * ============================================================
   *
   * GET /collection-entries/summary
   */

  async summary(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const query =
        collectionEntrySummaryQuerySchema.parse(
          request.query
        );

      const result =
        await collectionEntriesService.summary(
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
        "Erro ao gerar resumo das entradas de resíduos coletados."
      );

      return sendCollectionEntryError(
        reply,
        error,
        "Erro ao gerar resumo das entradas de resíduos coletados."
      );
    }
  }

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   *
   * GET /collection-entries/:id
   */

  async findById(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        getAuthenticatedUser(request);

      const params =
        collectionEntryIdParamsSchema.parse(
          request.params
        );

      const result =
        await collectionEntriesService.findById(
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
        "Erro ao buscar entrada de resíduo coletado."
      );

      return sendCollectionEntryError(
        reply,
        error,
        "Erro ao buscar entrada de resíduo coletado."
      );
    }
  }
}