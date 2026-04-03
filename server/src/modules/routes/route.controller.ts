import { FastifyReply, FastifyRequest } from "fastify";
import {
  createRouteSchema,
  routeCollectionParamsSchema,
  routeIdParamsSchema,
  updateRouteAssignmentsSchema,
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

      if (authUser.role === "COOPERATIVE") {
        const routes = await routeService.listByAuthenticatedCooperative(
          authUser.sub
        );

        return reply.send({
          success: true,
          routes,
        });
      }

      if (authUser.role === "DRIVER") {
        const routes = await routeService.listByAuthenticatedDriver(
          authUser.sub
        );

        return reply.send({
          success: true,
          routes,
        });
      }

      return reply.status(403).send({
        success: false,
        error: "Usuário sem permissão para listar rotas.",
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

      if (authUser.role !== "COOPERATIVE" && authUser.role !== "DRIVER") {
        return reply.status(403).send({
          success: false,
          error: "Usuário sem permissão para consultar rotas.",
        });
      }

      const route = await routeService.findById(
        authUser.sub,
        authUser.role,
        params.id
      );

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

  async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = routeIdParamsSchema.parse(request.params);
      const body = updateRouteAssignmentsSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem editar rotas.",
        });
      }

      const route = await routeService.updateAssignments(
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
        error: error.message || "Erro ao atualizar rota.",
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

  async listAvailableCollections(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem consultar coletas disponíveis.",
        });
      }

      const collections = await routeService.listAvailableCollectionsForRoute(
        authUser.sub
      );

      return reply.send({
        success: true,
        collections,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar coletas disponíveis.",
      });
    }
  }

  async addCollection(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = routeCollectionParamsSchema.parse(request.params);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem vincular coletas em rotas.",
        });
      }

      const collection = await routeService.addCollectionToRoute(
        authUser.sub,
        params.id,
        params.collectionId
      );

      return reply.send({
        success: true,
        collection,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao adicionar coleta na rota.",
      });
    }
  }

  async removeCollection(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = routeCollectionParamsSchema.parse(request.params);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem remover coletas das rotas.",
        });
      }

      const collection = await routeService.removeCollectionFromRoute(
        authUser.sub,
        params.id,
        params.collectionId
      );

      return reply.send({
        success: true,
        collection,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao remover coleta da rota.",
      });
    }
  }
}