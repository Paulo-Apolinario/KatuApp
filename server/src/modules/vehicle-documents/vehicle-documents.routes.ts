import type { FastifyInstance } from "fastify";
import { vehicleDocumentsController } from "./vehicle-documents.controller";

export async function vehicleDocumentsRoutes(app: FastifyInstance) {
  app.get(
    "/vehicle-documents",
    {
      preHandler: [app.authenticate],
    },
    vehicleDocumentsController.list
  );

  app.get(
    "/vehicle-documents/:id",
    {
      preHandler: [app.authenticate],
    },
    vehicleDocumentsController.findById
  );

  app.post(
    "/vehicle-documents",
    {
      preHandler: [app.authenticate],
    },
    vehicleDocumentsController.create
  );

  app.put(
    "/vehicle-documents/:id",
    {
      preHandler: [app.authenticate],
    },
    vehicleDocumentsController.update
  );

  app.delete(
    "/vehicle-documents/:id",
    {
      preHandler: [app.authenticate],
    },
    vehicleDocumentsController.remove
  );
}