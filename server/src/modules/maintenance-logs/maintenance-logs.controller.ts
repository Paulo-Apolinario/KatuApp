import type { FastifyReply, FastifyRequest } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import {
  createMaintenanceLogSchema,
  updateMaintenanceLogSchema,
} from "./maintenance-logs.schemas";
import { maintenanceLogsService } from "./maintenance-logs.service";

function getUserId(request: FastifyRequest) {
  const user = request.user as any;
  return user?.sub || user?.id || user?.userId;
}

async function parseMultipart(request: FastifyRequest) {
  const body: Record<string, any> = {};
  let fileUrl: string | null = null;

  const uploadDir = path.join(process.cwd(), "uploads", "maintenance-logs");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const parts = request.parts();

  for await (const part of parts) {
    if (part.type === "file") {
      if (!part.filename) continue;

      const extension = path.extname(part.filename);
      const fileName = `${randomUUID()}${extension}`;
      const fullPath = path.join(uploadDir, fileName);

      await pipeline(part.file, fs.createWriteStream(fullPath));

      fileUrl = `/uploads/maintenance-logs/${fileName}`;
      continue;
    }

    body[part.fieldname] = part.value;
  }

  return { body, fileUrl };
}

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
    try {
      const userId = getUserId(request);

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const parsed = await parseRequestBody(request);
      const validated = createMaintenanceLogSchema.parse(parsed.body);

      const data = await maintenanceLogsService.create(userId, validated, parsed.fileUrl);

      return reply.status(201).send({
        success: true,
        message: "Manutenção criada com sucesso.",
        data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao criar manutenção.");
    }
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const parsed = await parseRequestBody(request);
      const validated = updateMaintenanceLogSchema.parse(parsed.body);

      const data = await maintenanceLogsService.update(userId, id, validated, parsed.fileUrl);

      return reply.send({
        success: true,
        message: "Manutenção atualizada com sucesso.",
        data,
      });
    } catch (error: any) {
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