import { FastifyReply, FastifyRequest } from "fastify";
import {
  createDriverSchema,
  driverIdParamsSchema,
  updateDriverStatusSchema,
} from "./driver.schemas";
import { DriverService } from "./driver.service";

const driverService = new DriverService();

export class DriverController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const body = createDriverSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem cadastrar motoristas.",
        });
      }

      const driver = await driverService.create(authUser.sub, body);

      return reply.status(201).send({
        success: true,
        driver,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao criar motorista.",
      });
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem listar motoristas.",
        });
      }

      const drivers = await driverService.listByAuthenticatedCooperative(
        authUser.sub
      );

      return reply.send({
        success: true,
        drivers,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar motoristas.",
      });
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = driverIdParamsSchema.parse(request.params);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem consultar motoristas.",
        });
      }

      const driver = await driverService.findById(authUser.sub, params.id);

      return reply.send({
        success: true,
        driver,
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar motorista.",
      });
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = driverIdParamsSchema.parse(request.params);
      const body = updateDriverStatusSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem atualizar motoristas.",
        });
      }

      const driver = await driverService.updateStatus(
        authUser.sub,
        params.id,
        body
      );

      return reply.send({
        success: true,
        driver,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao atualizar status do motorista.",
      });
    }
  }
}