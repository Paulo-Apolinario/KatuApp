import {
  parseLegacyDocument,
  cleanupLegacyDocument,
} from "../owner-documents/owner-documents.routes";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createVehicleDocumentSchema,
  updateVehicleDocumentSchema,
} from "./vehicle-documents.schemas";
import { vehicleDocumentsService } from "./vehicle-documents.service";

function getUserId(request: FastifyRequest) {
  const user = request.user as any;
  return user?.sub || user?.id || user?.userId;
}

function normalizeBodyValue(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && "value" in (value as any)) {
    return (value as any).value;
  }

  return value;
}

const parseMultipart = (request: FastifyRequest) =>
  parseLegacyDocument(request, "vehicle-documents");

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

export const vehicleDocumentsController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const data = await vehicleDocumentsService.list(userId);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao listar documentos.");
    }
  },

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      const data = await vehicleDocumentsService.findById(userId, id);

      return reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao buscar documento.");
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

      const body = {
        vehicle_id: normalizeBodyValue(parsed.body.vehicle_id),
        document_type: normalizeBodyValue(parsed.body.document_type),
        document_number: normalizeBodyValue(parsed.body.document_number),
        issue_date: normalizeBodyValue(parsed.body.issue_date),
        expiry_date: normalizeBodyValue(parsed.body.expiry_date),
        notes: normalizeBodyValue(parsed.body.notes),
      };

      const validated = createVehicleDocumentSchema.parse(body);
      const data = await vehicleDocumentsService.create(
        userId,
        validated,
        parsed.fileUrl,
      );

      return reply.status(201).send({
        success: true,
        message: "Documento criado com sucesso.",
        data,
      });
    } catch (error: any) {
      await cleanupLegacyDocument(uploadedFile);
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao criar documento.");
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

      const body = {
        vehicle_id: normalizeBodyValue(parsed.body.vehicle_id),
        document_type: normalizeBodyValue(parsed.body.document_type),
        document_number: normalizeBodyValue(parsed.body.document_number),
        issue_date: normalizeBodyValue(parsed.body.issue_date),
        expiry_date: normalizeBodyValue(parsed.body.expiry_date),
        notes: normalizeBodyValue(parsed.body.notes),
      };

      const validated = updateVehicleDocumentSchema.parse(body);
      const data = await vehicleDocumentsService.update(
        userId,
        id,
        validated,
        parsed.fileUrl,
      );

      return reply.send({
        success: true,
        message: "Documento atualizado com sucesso.",
        data,
      });
    } catch (error: any) {
      await cleanupLegacyDocument(uploadedFile);
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao atualizar documento.");
    }
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = getUserId(request);
      const { id } = request.params as { id: string };

      if (!userId) {
        return reply.unauthorized("Usuário não autenticado.");
      }

      await vehicleDocumentsService.remove(userId, id);

      return reply.send({
        success: true,
        message: "Documento excluído com sucesso.",
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.badRequest(error.message || "Erro ao excluir documento.");
    }
  },
};
