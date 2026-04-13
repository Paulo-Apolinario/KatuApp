import { FastifyInstance } from "fastify";
import { ScheduleController } from "./schedule.controller";

const scheduleController = new ScheduleController();

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/ping", async () => {
    return {
      ok: true,
      module: "schedules",
    };
  });

  app.post("/", scheduleController.create);
  app.get("/", scheduleController.listMine);
  app.get("/:id", scheduleController.findById);
  app.patch("/:id/status", scheduleController.updateStatus);
}