import { FastifyInstance } from "fastify";
import { VehicleController } from "./vehicle.controller";

const vehicleController = new VehicleController();

export async function vehicleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/ping", async () => {
    return {
      ok: true,
      module: "vehicles",
    };
  });

  app.post("/", vehicleController.create);
  app.get("/", vehicleController.listMine);
  app.get("/:id", vehicleController.findById);
  app.patch("/:id/status", vehicleController.updateStatus);
}