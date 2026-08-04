import { FastifyInstance } from "fastify";
import { GeneratorController } from "./generator.controller";

const generatorController = new GeneratorController();

export async function generatorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/", async (request, reply) => generatorController.create(request, reply));
  app.get("/", async (request, reply) => generatorController.listMine(request, reply));
  app.get("/:id", async (request, reply) =>
    generatorController.findById(request, reply)
  );
}