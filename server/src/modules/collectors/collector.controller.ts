import { FastifyReply, FastifyRequest } from "fastify";
import {
  collectorIdParamsSchema,
  createCollectorSchema,
  updateCollectorStatusSchema,
} from "./collector.schemas";
import { CollectorService } from "./collector.service";

const collectorService = new CollectorService();

export class CollectorController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const body = createCollectorSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem cadastrar catadores.",
        });
      }

      const collector = await collectorService.create(authUser.sub, body);

      return reply.status(201).send({
        success: true,
        collector,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao criar catador.",
      });
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem listar catadores.",
        });
      }

      const collectors = await collectorService.listByAuthenticatedCooperative(
        authUser.sub
      );

      return reply.send({
        success: true,
        collectors,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar catadores.",
      });
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = collectorIdParamsSchema.parse(request.params);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem consultar catadores.",
        });
      }

      const collector = await collectorService.findById(
        authUser.sub,
        params.id
      );

      return reply.send({
        success: true,
        collector,
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar catador.",
      });
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = collectorIdParamsSchema.parse(request.params);
      const body = updateCollectorStatusSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem atualizar status de catadores.",
        });
      }

      const collector = await collectorService.updateStatus(
        authUser.sub,
        params.id,
        body.status
      );

      return reply.send({
        success: true,
        collector,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao atualizar status do catador.",
      });
    }
  }
}