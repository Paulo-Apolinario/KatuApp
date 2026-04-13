import { FastifyInstance } from "fastify";
import { CollectionController } from "./collection.controller";

const collectionController = new CollectionController();

export async function collectionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/ping", async () => {
    return {
      ok: true,
      module: "collections",
    };
  });

  app.post("/", collectionController.create);
  app.get("/", collectionController.listMine);
  app.get("/:id", collectionController.findById);
  app.patch("/:id/status", collectionController.updateStatus);
}