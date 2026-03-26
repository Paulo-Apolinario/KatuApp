import { FastifyInstance } from "fastify";
import { CooperativesController } from "./cooperatives.controller";

const cooperativesController = new CooperativesController();

export async function cooperativesRoutes(app: FastifyInstance) {
  app.get(
    "/cooperatives",
    {
      onRequest: [app.authenticate],
    },
    cooperativesController.list
  );

  app.get(
    "/cooperatives/:id",
    {
      onRequest: [app.authenticate],
    },
    cooperativesController.getById
  );
}