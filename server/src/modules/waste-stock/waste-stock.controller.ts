import { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import {
  createLegacyWasteStockSchema,
  createWasteStockItemSchema,
  createWasteStockLotSchema,
  updateWasteStockItemSchema,
  updateWasteStockLotSchema,
  wasteStockItemIdParamsSchema,
  wasteStockLotIdParamsSchema,
} from "./waste-stock.schemas";

import { WasteStockService } from "./waste-stock.service";

const wasteStockService = new WasteStockService();

type AuthUser = {
  id?: string;
  sub?: string;
  userId?: string;
  role?: string;
};

function getErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

function getValidationErrors(error: unknown) {
  if (!(error instanceof ZodError)) {
    return undefined;
  }

  return error.flatten().fieldErrors;
}

function getStatusCode(error: unknown) {
  const message = getErrorMessage(error, "");

  const notFoundMessages = [
    "Tipo de resíduo não encontrado.",
    "Material de estoque não encontrado.",
    "Lote não encontrado.",
    "Cooperativa do usuário autenticado não encontrada.",
  ];

  if (notFoundMessages.includes(message)) {
    return 404;
  }

  if (
    message.includes("Apenas cooperativas") ||
    message.includes("não está vinculado a uma cooperativa")
  ) {
    return 403;
  }

  return 400;
}

export class WasteStockController {
  /*
   * ============================================================
   * CATÁLOGO DE TIPOS DE RESÍDUOS
   * ============================================================
   */

  async listItems(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = request.query as {
        status?: string;
        category?: string;
        search?: string;
      };

      const result = await wasteStockService.listItems(
        request.user as AuthUser,
        {
          status:
            query?.status === "ACTIVE" ||
            query?.status === "INACTIVE"
              ? query.status
              : undefined,
          category: query?.category,
          search: query?.search,
        }
      );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao listar tipos de resíduos:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao listar tipos de resíduos."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async findItemById(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockItemIdParamsSchema.parse(
          request.params
        );

      const result =
        await wasteStockService.findItemById(
          request.user as AuthUser,
          params.id
        );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao buscar tipo de resíduo:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao buscar tipo de resíduo."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async createItem(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const body =
        createWasteStockItemSchema.parse(
          request.body
        );

      const result =
        await wasteStockService.createItem(
          request.user as AuthUser,
          body
        );

      return reply.status(201).send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao cadastrar tipo de resíduo:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao cadastrar tipo de resíduo."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async updateItem(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockItemIdParamsSchema.parse(
          request.params
        );

      const body =
        updateWasteStockItemSchema.parse(
          request.body
        );

      const result =
        await wasteStockService.updateItem(
          request.user as AuthUser,
          params.id,
          body
        );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao atualizar tipo de resíduo:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao atualizar tipo de resíduo."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async deactivateItem(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockItemIdParamsSchema.parse(
          request.params
        );

      const result =
        await wasteStockService.deactivateItem(
          request.user as AuthUser,
          params.id
        );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao inativar tipo de resíduo:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao inativar tipo de resíduo."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  /*
   * ============================================================
   * LOTES DE ESTOQUE
   * ============================================================
   */

  async listLots(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockItemIdParamsSchema.parse(
          request.params
        );

      const result =
        await wasteStockService.listLots(
          request.user as AuthUser,
          params.id
        );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao listar lotes:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao listar lotes."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async createLot(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockItemIdParamsSchema.parse(
          request.params
        );

      const body =
        createWasteStockLotSchema.parse(
          request.body
        );

      const result =
        await wasteStockService.createLot(
          request.user as AuthUser,
          params.id,
          body
        );

      return reply.status(201).send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao cadastrar lote:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao cadastrar lote."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async updateLot(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockLotIdParamsSchema.parse(
          request.params
        );

      const body =
        updateWasteStockLotSchema.parse(
          request.body
        );

      const result =
        await wasteStockService.updateLot(
          request.user as AuthUser,
          params.lotId,
          body
        );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao atualizar lote:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao atualizar lote."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async discardLot(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockLotIdParamsSchema.parse(
          request.params
        );

      const result =
        await wasteStockService.discardLot(
          request.user as AuthUser,
          params.lotId
        );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao descartar lote:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao descartar lote."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  /*
   * ============================================================
   * ROTAS DE COMPATIBILIDADE COM O FRONTEND ATUAL
   * ============================================================
   */

  async listMine(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    return this.listItems(request, reply);
  }

  async findById(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    return this.findItemById(request, reply);
  }

  async create(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const body =
        createLegacyWasteStockSchema.parse(
          request.body
        );

      const result =
        await wasteStockService.create(
          request.user as AuthUser,
          body
        );

      return reply.status(201).send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao cadastrar material e lote:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao cadastrar estoque de resíduos."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async update(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const params =
        wasteStockItemIdParamsSchema.parse(
          request.params
        );

      const rawBody =
        request.body as {
          item?: unknown;
        };

      const payload =
        rawBody &&
        typeof rawBody === "object" &&
        "item" in rawBody
          ? rawBody.item
          : rawBody;

      const body =
        updateWasteStockItemSchema.parse(
          payload
        );

      const result =
        await wasteStockService.updateItem(
          request.user as AuthUser,
          params.id,
          body
        );

      return reply.send(result);
    } catch (error: unknown) {
      console.error(
        "Erro ao atualizar material de estoque:",
        error
      );

      return reply.status(getStatusCode(error)).send({
        success: false,
        error: getErrorMessage(
          error,
          "Erro ao atualizar material de estoque."
        ),
        errors: getValidationErrors(error),
      });
    }
  }

  async delete(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    return this.deactivateItem(request, reply);
  }

  async deleteLot(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    return this.discardLot(request, reply);
  }
}