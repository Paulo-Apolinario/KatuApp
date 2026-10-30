import type { FastifyInstance } from "fastify";
import { maintenanceLogsController } from "./maintenance-logs.controller";

export async function maintenanceLogsRoutes(app: FastifyInstance) {
  app.get(
    "/maintenance-logs",
    {
      preHandler: [app.authenticate],
    },
    maintenanceLogsController.list
  );

  app.get(
    "/maintenance-logs/:id",
    {
      preHandler: [app.authenticate],
    },
    maintenanceLogsController.findById
  );

  app.post(
    "/maintenance-logs",
    {
      preHandler: [app.authenticate],
    },
    maintenanceLogsController.create
  );

  app.put(
    "/maintenance-logs/:id",
    {
      preHandler: [app.authenticate],
    },
    maintenanceLogsController.update
  );

  app.delete(
    "/maintenance-logs/:id",
    {
      preHandler: [app.authenticate],
    },
    maintenanceLogsController.remove
  );
}