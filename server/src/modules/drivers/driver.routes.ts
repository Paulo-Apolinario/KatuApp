import { FastifyInstance } from "fastify";
import { DriverController } from "./driver.controller";

const driverController = new DriverController();

export async function driverRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/ping", async () => {
    return {
      ok: true,
      module: "drivers",
    };
  });

  app.get("/me", driverController.me);
  app.patch("/me", driverController.updateMe);
  app.get("/me/reports", driverController.listMyReports);
  app.post("/me/reports", driverController.createReport);

  app.post("/", driverController.create);
  app.get("/", driverController.listMine);
  app.get("/:id", driverController.findById);
  app.patch("/:id/status", driverController.updateStatus);
}