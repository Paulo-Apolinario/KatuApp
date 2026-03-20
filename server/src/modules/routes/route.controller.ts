import { FastifyReply, FastifyRequest } from "fastify";
import {
  createRouteSchema,
  routeIdParamsSchema,
  updateRouteStatusSchema,
} from "./route.schemas";
import { RouteService } from "./route.service";

const routeService = new RouteService();

export class RouteController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const body = createRouteSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem cadastrar rotas.",
        });
      }

      const route = await routeService.create(authUser.sub, body);

      return reply.status(201).send({
        success: true,
        route,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao criar rota.",
      });
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem listar rotas.",
        });
      }

      const routes = await routeService.listByAuthenticatedCooperative(
        authUser.sub
      );

      return reply.send({
        success: true,
        routes,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar rotas.",
      });
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = routeIdParamsSchema.parse(request.params);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem consultar rotas.",
        });
      }

      const route = await routeService.findById(authUser.sub, params.id);

      return reply.send({
        success: true,
        route,
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar rota.",
      });
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = routeIdParamsSchema.parse(request.params);
      const body = updateRouteStatusSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem atualizar rotas.",
        });
      }

      const route = await routeService.updateStatus(
        authUser.sub,
        params.id,
        body
      );

      return reply.send({
        success: true,
        route,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao atualizar status da rota.",
      });
    }
  }
}
