import { FastifyInstance } from "fastify";
import { GeneratorController } from "./generator.controller";

const generatorController = new GeneratorController();

export async function generatorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.post("/", generatorController.create);
  app.get("/", generatorController.listMine);
  app.get("/:id", generatorController.findById);
}
