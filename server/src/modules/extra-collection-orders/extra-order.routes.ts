import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { ExtraOrderService } from "./extra-order.service";
import {
  createExtraOrder,
  reviseExtraOrder,
  reviewExtraOrder,
  receiveExtraOrder,
} from "./extra-order.schemas";
import { isCollectionDomainError } from "../collections/collection.types";
export async function extraOrderRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  const service = new ExtraOrderService();
  app.setErrorHandler((e, request, reply) => {
    if (e instanceof ZodError)
      return reply
        .code(400)
        .send({ error: e.issues[0]?.message, code: "VALIDATION_ERROR" });
    if (isCollectionDomainError(e))
      return reply.code(e.statusCode).send({ error: e.message, code: e.code });
    request.log.error({ err: e }, "O.C. failed");
    return reply.code((e as any).statusCode || 500).send({
      error:
        "Não foi possível processar a O.C. Atualize e confira o protocolo antes de reenviar.",
    });
  });
  const auth = (r: any) => ({ id: r.user.sub || r.user.id, role: r.user.role });
  const id = (r: any) => z.string().uuid().parse(r.params.id);
  app.get("/context", async (r) => {
    const a = auth(r);
    return service.contextData(a.id, a.role);
  });
  app.get("/", async (r) => {
    const a = auth(r),
      q = z
        .object({
          page: z.coerce.number().int().positive().optional(),
          status: z
            .enum(["PENDING_REVIEW", "NEEDS_INFO", "ACCEPTED", "REJECTED"])
            .optional(),
          search: z.string().max(150).optional(),
        })
        .parse(r.query);
    return service.list(a.id, a.role, q);
  });
  app.get("/:id", async (r) => {
    const a = auth(r);
    return { order: await service.get(a.id, a.role, id(r)) };
  });
  app.post("/", { bodyLimit: 2300000 }, async (r, reply) => {
    const a = auth(r);
    return reply.code(201).send({
      order: await service.create(a.id, a.role, createExtraOrder.parse(r.body)),
    });
  });
  app.post("/:id/revise", { bodyLimit: 2300000 }, async (r) => {
    const a = auth(r);
    return {
      order: await service.revise(
        a.id,
        a.role,
        id(r),
        reviseExtraOrder.parse(r.body),
      ),
    };
  });
  app.post("/:id/review", async (r) => {
    const a = auth(r);
    return {
      order: await service.review(
        a.id,
        a.role,
        id(r),
        reviewExtraOrder.parse(r.body),
      ),
    };
  });
  app.post("/:id/receive", async (r) => {
    const a = auth(r);
    return {
      order: await service.receive(
        a.id,
        a.role,
        id(r),
        receiveExtraOrder.parse(r.body),
      ),
    };
  });
}
