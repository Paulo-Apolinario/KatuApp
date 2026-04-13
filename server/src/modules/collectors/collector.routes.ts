import { FastifyInstance } from "fastify";
import { CollectorController } from "./collector.controller";

const collectorController = new CollectorController();

export async function collectorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/ping", async () => {
    return {
      ok: true,
      module: "collectors",
    };
  });

  app.post("/", collectorController.create);
  app.get("/", collectorController.listMine);
  app.get("/:id", collectorController.findById);
  app.patch("/:id/status", collectorController.updateStatus);
}