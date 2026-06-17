import type { FastifyReply, FastifyRequest } from "fastify";
import { createBinSchema, updateBinSchema } from "./bins.schemas";
import { binsService } from "./bins.service";

function getUserId(request: FastifyRequest) {
  const user = request.user as any;

  return user?.sub || user?.id || user?.userId;
}

export const binsController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const data = await binsService.list(userId);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao listar lixeiras.");
    }
  },

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const data = await binsService.findById(userId, id);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao buscar lixeira.");
    }
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const body = createBinSchema.parse(request.body);
      const data = await binsService.create(userId, body);

      return reply.status(201).send({
        success: true,
        message: "Lixeira criada com sucesso.",
        data,
      });
    } catch (error: any) {
      request.log.error(error);

      return reply.badRequest(error.message || "Erro ao criar lixeira.");
    }
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const body = updateBinSchema.parse(request.body);
      const data = await binsService.update(userId, id, body);

      return reply.send({
        success: true,
        message: "Lixeira atualizada com sucesso.",
        data,
      });
    } catch (error: any) {
      request.log.error(error);

      return reply.badRequest(error.message || "Erro ao atualizar lixeira.");
    }
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      await binsService.remove(userId, id);

      return reply.send({
        success: true,
        message: "Lixeira excluída com sucesso.",
      });
    } catch (error: any) {
      request.log.error(error);

      return reply.badRequest(error.message || "Erro ao excluir lixeira.");
    }
  },
};