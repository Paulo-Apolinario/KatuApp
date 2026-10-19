import type { FastifyInstance } from "fastify";
import { binsController as c } from "./bins.controller";
export async function binsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };
  app.get("/bins", auth, c.list);
  app.post("/bins", auth, c.create);
  app.get("/bins/:id/events", auth, c.events);
  app.post("/bins/:id/events", auth, c.event);
  app.post("/bins/:id/events/:eventId/resolve", auth, c.resolve);
  app.get("/bins/:id/withdrawals", auth, c.withdrawals);
  app.post("/bins/:id/withdrawals", auth, c.pickup);
  app.put("/bins/:id/photo", auth, c.photo);
  app.delete("/bins/:id/photo", auth, c.removePhoto);
  app.get("/bins/:id", auth, c.findById);
  app.put("/bins/:id", auth, c.update);
  app.delete("/bins/:id", auth, c.remove);
}
