import {
  parseLegacyDocument,
  cleanupLegacyDocument,
} from "../owner-documents/owner-documents.routes";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createMaintenanceLogSchema,
  updateMaintenanceLogSchema,
} from "./maintenance-logs.schemas";
import { maintenanceLogsService } from "./maintenance-logs.service";

function getUserId(request: FastifyRequest) {
  const user = request.user as any;
  return user?.sub || user?.id || user?.userId;
}

const parseMultipart = (request: FastifyRequest) =>
  parseLegacyDocument(request, "maintenance-logs");

async function parseRequestBody(request: FastifyRequest) {
  const contentType = request.headers["content-type"] || "";

  if (String(contentType).includes("multipart/form-data")) {
    return parseMultipart(request);
  }

  return {
    body: request.body as Record<string, any>,
    fileUrl: null,
  };
}

export const maintenanceLogsController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const data = await maintenanceLogsService.list(userId);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao listar manutenções.");
    }
  },

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const data = await maintenanceLogsService.findById(userId, id);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao buscar manutenção.");
    }
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    let uploadedFile: string | null = null;
    try {
      const userId = getUserId(request);

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const parsed = await parseRequestBody(request);
      uploadedFile = parsed.fileUrl;
      const validated = createMaintenanceLogSchema.parse(parsed.body);

      const data = await maintenanceLogsService.create(
        userId,
        validated,
        parsed.fileUrl,
      );

      return reply.status(201).send({
        success: true,
        message: "Manutenção criada com sucesso.",
        data,
      });
    } catch (error: any) {
      await cleanupLegacyDocument(uploadedFile);
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao criar manutenção.");
    }
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    let uploadedFile: string | null = null;
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const parsed = await parseRequestBody(request);
      uploadedFile = parsed.fileUrl;
      const validated = updateMaintenanceLogSchema.parse(parsed.body);

      const data = await maintenanceLogsService.update(
        userId,
        id,
        validated,
        parsed.fileUrl,
      );

      return reply.send({
        success: true,
        message: "Manutenção atualizada com sucesso.",
        data,
      });
    } catch (error: any) {
      await cleanupLegacyDocument(uploadedFile);
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao atualizar manutenção.");
    }
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      await maintenanceLogsService.remove(userId, id);

      return reply.send({
        success: true,
        message: "Manutenção excluída com sucesso.",
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao excluir manutenção.");
    }
  },
};
