import { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import {
  cancelCollectionSchema,
  collectionIdParamsSchema,
  completeCollectionSchema,
  completeFieldCollectionSchema,
  createCollectionSchema,
  receiveCollectionSchema,
  startCollectionSchema,
  startSortingSchema,
  updateCollectionStatusSchema,
} from "./collection.schemas";
import { CollectionService } from "./collection.service";
import { isCollectionDomainError, type AuthenticatedUser } from "./collection.types";

const collectionService = new CollectionService();

function getZodErrorMessage(error: ZodError, fallbackMessage: string) {
  return error.issues[0]?.message || fallbackMessage;
}

function getZodFieldErrors(error: ZodError) {
  return error.flatten().fieldErrors;
}

function getAuthenticatedUser(request: FastifyRequest): AuthenticatedUser {
  const authUser = request.user as Partial<AuthenticatedUser>;
  const userId = authUser?.sub || authUser?.id || authUser?.userId;
  const role = String(authUser?.role || "").trim().toUpperCase();

  if (!userId) throw new Error("Usuário autenticado não identificado.");
  if (!role) throw new Error("Perfil do usuário autenticado não identificado.");

  return { sub: userId, role, id: authUser.id, userId: authUser.userId };
}

function sendCollectionError(reply: FastifyReply, error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: getZodErrorMessage(error, fallbackMessage),
      code: "VALIDATION_ERROR",
      errors: getZodFieldErrors(error),
    });
  }

  if (isCollectionDomainError(error)) {
    return reply.status(error.statusCode).send({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }

  if (error instanceof Error) {
    const statusCode = error.message.includes("autenticado não identificado") ? 401 : 400;
    return reply.status(statusCode).send({
      success: false,
      error: error.message || fallbackMessage,
      code: statusCode === 401 ? "AUTHENTICATION_ERROR" : "COLLECTION_ERROR",
    });
  }

  return reply.status(500).send({
    success: false,
    error: fallbackMessage,
    code: "INTERNAL_SERVER_ERROR",
  });
}

export class CollectionController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const body = createCollectionSchema.parse(request.body);
      const collection = await collectionService.create(authUser.sub, authUser.role, body);
      return reply.status(201).send({ success: true, message: "Coleta criada e delegada com sucesso.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao criar coleta.");
      return sendCollectionError(reply, error, "Erro ao criar coleta.");
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const collections = await collectionService.listMine(authUser.sub, authUser.role);
      return reply.send({ success: true, collections, total: collections.length });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao listar coletas.");
      return sendCollectionError(reply, error, "Erro ao listar coletas.");
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const collection = await collectionService.findById(authUser.sub, authUser.role, params.id);
      return reply.send({ success: true, collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao buscar coleta.");
      return sendCollectionError(reply, error, "Erro ao buscar coleta.");
    }
  }

  async start(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const body = startCollectionSchema.parse(request.body ?? {});
      const collection = await collectionService.start(authUser.sub, authUser.role, params.id, body);
      return reply.send({ success: true, message: "Coleta iniciada com sucesso.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao iniciar coleta.");
      return sendCollectionError(reply, error, "Erro ao iniciar coleta.");
    }
  }

  async completeField(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const body = completeFieldCollectionSchema.parse(request.body);
      const collection = await collectionService.completeField(authUser.sub, authUser.role, params.id, body);
      return reply.send({ success: true, message: "Etapa de campo concluída. O material aguarda recebimento pela cooperativa.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao concluir etapa de campo.");
      return sendCollectionError(reply, error, "Erro ao concluir etapa de campo.");
    }
  }

  async receive(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const body = receiveCollectionSchema.parse(request.body ?? {});
      const collection = await collectionService.receive(authUser.sub, authUser.role, params.id, body);
      return reply.send({ success: true, message: "Recebimento confirmado com sucesso.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao confirmar recebimento.");
      return sendCollectionError(reply, error, "Erro ao confirmar recebimento.");
    }
  }

  async startSorting(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const body = startSortingSchema.parse(request.body ?? {});
      const collection = await collectionService.startSorting(authUser.sub, authUser.role, params.id, body);
      return reply.send({ success: true, message: "Triagem iniciada com sucesso.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao iniciar triagem.");
      return sendCollectionError(reply, error, "Erro ao iniciar triagem.");
    }
  }

  async complete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const body = completeCollectionSchema.parse(request.body ?? {});
      const collection = await collectionService.complete(authUser.sub, authUser.role, params.id, body);
      return reply.send({ success: true, message: "Coleta concluída operacionalmente com sucesso.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao concluir coleta.");
      return sendCollectionError(reply, error, "Erro ao concluir coleta.");
    }
  }

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const body = cancelCollectionSchema.parse(request.body);
      const collection = await collectionService.cancel(authUser.sub, authUser.role, params.id, body);
      return reply.send({ success: true, message: "Coleta cancelada com sucesso.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao cancelar coleta.");
      return sendCollectionError(reply, error, "Erro ao cancelar coleta.");
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = getAuthenticatedUser(request);
      const params = collectionIdParamsSchema.parse(request.params);
      const body = updateCollectionStatusSchema.parse(request.body);
      const collection = await collectionService.updateStatus(authUser.sub, authUser.role, params.id, body);
      return reply.send({ success: true, message: "Status da coleta atualizado com sucesso.", collection });
    } catch (error: unknown) {
      request.log.error({ error }, "Erro ao atualizar status da coleta.");
      return sendCollectionError(reply, error, "Erro ao atualizar status da coleta.");
    }
  }
}