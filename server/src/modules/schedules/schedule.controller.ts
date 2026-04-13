import { FastifyReply, FastifyRequest } from "fastify";
import {
  createScheduleSchema,
  scheduleIdParamsSchema,
  updateScheduleStatusSchema,
} from "./schedule.schemas";
import { ScheduleService } from "./schedule.service";

const scheduleService = new ScheduleService();

export class ScheduleController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const body = createScheduleSchema.parse(request.body);

      const schedule = await scheduleService.create(
        authUser.sub,
        authUser.role,
        body
      );

      return reply.status(201).send({
        success: true,
        schedule,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao criar agendamento.",
      });
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      const schedules = await scheduleService.listMine(
        authUser.sub,
        authUser.role
      );

      return reply.send({
        success: true,
        schedules,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar agendamentos.",
      });
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = scheduleIdParamsSchema.parse(request.params);

      const schedule = await scheduleService.findById(
        authUser.sub,
        authUser.role,
        params.id
      );

      return reply.send({
        success: true,
        schedule,
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar agendamento.",
      });
    }
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = scheduleIdParamsSchema.parse(request.params);
      const body = updateScheduleStatusSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem atualizar agendamentos.",
        });
      }

      const schedule = await scheduleService.updateStatus(
        authUser.sub,
        params.id,
        body
      );

      return reply.send({
        success: true,
        schedule,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao atualizar status do agendamento.",
      });
    }
  }
}