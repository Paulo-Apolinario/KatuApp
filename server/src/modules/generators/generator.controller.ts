import { ZodError } from "zod";
import { FastifyReply, FastifyRequest } from "fastify";
import {
  createGeneratorSchema,
  updateGeneratorSchema,
  generatorIdParamsSchema,
} from "./generator.schemas";
import { GeneratorService } from "./generator.service";

const generatorService = new GeneratorService();
function failure(error: any, reply: FastifyReply) {
  const duplicate = error.code === "P2002";
  const target = String(error.meta?.target || "");
  const message = error instanceof ZodError ? error.issues.map(issue => issue.message).join(" ")
    : duplicate ? (target.includes("documentNumber") ? "Já existe um gerador nesta cooperativa com este CPF/CNPJ." : "Já existe um cadastro com este e-mail.")
    : error.code || error.name?.startsWith("PrismaClient") ? "Não foi possível salvar o gerador. Atualize e tente novamente."
    : error.message || "Erro ao salvar gerador.";
  return reply.code(duplicate ? 409 : error.statusCode || 400).send({ success: false, error: message });
}

export class GeneratorController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string; role: string };

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem cadastrar geradores.",
        });
      }

      const body = createGeneratorSchema.parse(request.body);
      const generator = await generatorService.create(authUser.sub, body);

      return reply.status(201).send({
        success: true,
        generator,
      });
    } catch (error: any) {
      return failure(error, reply);
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as { sub: string; role: string };
    if (user.role !== "COOPERATIVE") return reply.forbidden("Apenas cooperativas podem atualizar geradores.");
    const params = generatorIdParamsSchema.safeParse(request.params);
    const body = updateGeneratorSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.badRequest(
      !body.success ? body.error.issues.map((issue) => issue.message).join(" ") : "ID inválido.",
    );
    try {
      const generator = await generatorService.update(user.sub, params.data.id, body.data);
      if (!generator) return reply.notFound("Gerador não encontrado.");
      return reply.send({ success: true, generator });
    } catch (error) { return failure(error, reply); }
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

      if (authUser.role !== "COOPERATIVE") {
        return reply.status(403).send({
          success: false,
          error: "Apenas cooperativas podem consultar geradores.",
        });
      }

      const params = generatorIdParamsSchema.parse(request.params);
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