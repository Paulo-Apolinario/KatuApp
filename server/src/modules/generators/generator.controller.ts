import { FastifyReply, FastifyRequest } from "fastify";
import {
  createGeneratorSchema,
  generatorIdParamsSchema,
} from "./generator.schemas";
import { GeneratorService } from "./generator.service";

const generatorService = new GeneratorService();

export class GeneratorController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const body = createGeneratorSchema.parse(request.body);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem cadastrar geradores.",
        });
      }

      const generator = await generatorService.create(authUser.sub, body);

      return reply.status(201).send({
        success: true,
        generator,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao criar gerador.",
      });
    }
  }

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem listar geradores.",
        });
      }

      const generators = await generatorService.listByAuthenticatedCooperative(
        authUser.sub
      );

      return reply.send({
        success: true,
        generators,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao listar geradores.",
      });
    }
  }

  async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };
      const params = generatorIdParamsSchema.parse(request.params);

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem consultar geradores.",
        });
      }

      const generator = await generatorService.findById(authUser.sub, params.id);

      return reply.send({
        success: true,
        generator,
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar gerador.",
      });
    }
  }
}
