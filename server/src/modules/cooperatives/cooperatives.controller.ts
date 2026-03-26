import { FastifyReply, FastifyRequest } from "fastify";
import { cooperativeIdParamsSchema } from "./cooperatives.schemas";
import { CooperativesService } from "./cooperatives.service";

const cooperativesService = new CooperativesService();

export class CooperativesController {
  async list(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const cooperatives = await cooperativesService.listActive();

      return reply.status(200).send({
        cooperatives,
      });
    } catch (error: any) {
      console.error("Erro ao listar cooperativas:", error);

      return reply.status(400).send({
        message: error?.message || "Não foi possível listar as cooperativas.",
      });
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = cooperativeIdParamsSchema.parse(request.params);
      const cooperative = await cooperativesService.getById(params.id);

      return reply.status(200).send({
        cooperative,
      });
    } catch (error: any) {
      console.error("Erro ao buscar cooperativa:", error);

      return reply.status(400).send({
        message: error?.message || "Não foi possível buscar a cooperativa.",
      });
    }
  }
}