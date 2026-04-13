import { FastifyInstance } from "fastify";
import { RouteController } from "./route.controller";

const routeController = new RouteController();

export async function routeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/ping", async () => {
    return {
      ok: true,
      module: "routes",
    };
  });

  app.post("/", routeController.create);
  app.get("/", routeController.listMine);
  app.get("/available-collections", routeController.listAvailableCollections);
  app.get("/:id", routeController.findById);
  app.patch("/:id", routeController.update);
  app.patch("/:id/status", routeController.updateStatus);
  app.post("/:id/collections/:collectionId", routeController.addCollection);
  app.delete("/:id/collections/:collectionId", routeController.removeCollection);
}