import { FastifyReply, FastifyRequest } from "fastify";
import {
  cooperativeIdParamsSchema,
  updateCooperativeLocationSchema,
} from "./cooperatives.schemas";
import { CooperativesService } from "./cooperatives.service";

const cooperativesService = new CooperativesService();

type JwtUserPayload = {
  sub?: string;
  id?: string;
  userId?: string;
  role?: string;
  email?: string;
};

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

  async updateMyLocation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as JwtUserPayload | undefined;
      const userId = authUser?.sub || authUser?.id || authUser?.userId || null;

      if (!userId) {
        return reply.status(401).send({
          message: "Usuário não autenticado.",
        });
      }

      const body = updateCooperativeLocationSchema.parse(request.body);

      const cooperative = await cooperativesService.updateLocationByUserId(
        userId,
        body
      );

      return reply.status(200).send({
        cooperative,
      });
    } catch (error: any) {
      console.error("Erro ao atualizar localização da cooperativa:", error);

      return reply.status(400).send({
        message:
          error?.message ||
          "Não foi possível atualizar a localização da cooperativa.",
      });
    }
  }
}