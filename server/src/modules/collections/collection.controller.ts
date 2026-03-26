import { FastifyReply, FastifyRequest } from "fastify";
import {
  collectionIdParamsSchema,
  createCollectionSchema,
  updateCollectionStatusSchema,
} from "./collection.schemas";
import { CollectionService } from "./collection.service";

const collectionService = new CollectionService();

export class CollectionController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const body = createCollectionSchema.parse(request.body);

      const collection = await collectionService.create(
        authUser.sub,
        authUser.role,
        body
      );

      return reply.status(201).send({
        success: true,
        collection,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao criar coleta.",
      });
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      const collections = await collectionService.listMine(
        authUser.sub,
        authUser.role
      );

      return reply.send({
        success: true,
        collections,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar coletas.",
      });
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = collectionIdParamsSchema.parse(request.params);

      const collection = await collectionService.findById(
        authUser.sub,
        authUser.role,
        params.id
      );

      return reply.send({
        success: true,
        collection,
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar coleta.",
      });
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = collectionIdParamsSchema.parse(request.params);
      const body = updateCollectionStatusSchema.parse(request.body);

      if (
        authUser.role !== "COOPERATIVE" &&
        authUser.role !== "COLLECTOR"
      ) {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas ou catadores podem atualizar coletas.",
        });
      }

      const collection = await collectionService.updateStatus(
        authUser.sub,
        authUser.role,
        params.id,
        body
      );

      return reply.send({
        success: true,
        collection,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao atualizar status da coleta.",
      });
    }
  }
}