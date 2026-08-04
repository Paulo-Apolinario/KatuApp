import type { FastifyInstance } from "fastify";
import { binsController } from "./bins.controller";

export async function binsRoutes(app: FastifyInstance) {
  app.get(
    "/bins",
    {
      preHandler: [app.authenticate],
    },
    binsController.list
  );

  app.get(
    "/bins/:id",
    {
      preHandler: [app.authenticate],
    },
    binsController.findById
  );

  app.post(
    "/bins",
    {
      preHandler: [app.authenticate],
    },
    binsController.create
  );

  app.put(
    "/bins/:id",
    {
      preHandler: [app.authenticate],
    },
    binsController.update
  );

  app.delete(
    "/bins/:id",
    {
      preHandler: [app.authenticate],
    },
    binsController.remove
  );
}