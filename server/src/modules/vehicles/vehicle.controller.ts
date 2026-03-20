import { FastifyReply, FastifyRequest } from "fastify";
import {
  createVehicleSchema,
  updateVehicleStatusSchema,
  vehicleIdParamsSchema,
} from "./vehicle.schemas";
import { VehicleService } from "./vehicle.service";

const vehicleService = new VehicleService();

export class VehicleController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const body = createVehicleSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem cadastrar veículos.",
        });
      }

      const vehicle = await vehicleService.create(authUser.sub, body);

      return reply.status(201).send({
        success: true,
        vehicle,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao criar veículo.",
      });
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem listar veículos.",
        });
      }

      const vehicles = await vehicleService.listByAuthenticatedCooperative(
        authUser.sub
      );

      return reply.send({
        success: true,
        vehicles,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar veículos.",
      });
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = vehicleIdParamsSchema.parse(request.params);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem consultar veículos.",
        });
      }

      const vehicle = await vehicleService.findById(authUser.sub, params.id);

      return reply.send({
        success: true,
        vehicle,
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar veículo.",
      });
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = vehicleIdParamsSchema.parse(request.params);
      const body = updateVehicleStatusSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem atualizar veículos.",
        });
      }

      const vehicle = await vehicleService.updateStatus(
        authUser.sub,
        params.id,
        body
      );

      return reply.send({
        success: true,
        vehicle,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao atualizar status do veículo.",
      });
    }
  }
}
