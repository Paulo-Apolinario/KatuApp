import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { BinError } from "../bins/bins.service";
import { pevActor, pevRequestService as service } from "./pev-request.service";
import {
  createPevRequest,
  updatePevRequest,
  pevRequestQuery,
} from "./pev-request.schemas";
export async function pevRequestRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.setErrorHandler((e, r, reply) => {
    if (e instanceof ZodError)
      return reply.code(400).send({ message: e.issues[0]?.message });
    if (e instanceof BinError)
      return reply.code(e.statusCode).send({ message: e.message });
    const status = (e as any).statusCode;
    if (status === 401 || status === 403)
      return reply
        .code(status)
        .send({ message: "Sessão inválida ou sem acesso. Entre novamente." });
    r.log.error({ err: e }, "PEV request failed");
    return reply.code((e as any).statusCode === 413 ? 413 : 500).send({
      message:
        "Não foi possível concluir o pedido. Consulte o protocolo antes de reenviar.",
    });
  });
  const actor = (r: any) => pevActor(r.user.sub || r.user.id);
  const id = (r: any) => z.string().uuid().parse(r.params.id);
  app.get("/pev-points", async (r) =>
    service.bins(await actor(r), pevRequestQuery.parse(r.query)),
  );
  app.get("/pev-requests", async (r) =>
    service.list(await actor(r), pevRequestQuery.parse(r.query)),
  );
  app.get("/pev-requests/:id", async (r) => ({
    request: await service.detail(
      await actor(r),
      id(r),
      pevRequestQuery.parse(r.query).page,
    ),
  }));
  app.post("/pev-requests", { bodyLimit: 1100000 }, async (r, reply) =>
    reply.code(201).send({
      request: await service.create(
        await actor(r),
        createPevRequest.parse(r.body),
      ),
    }),
  );
  app.post("/pev-requests/:id/updates", { bodyLimit: 1100000 }, async (r) => ({
    request: await service.update(
      await actor(r),
      id(r),
      updatePevRequest.parse(r.body),
    ),
  }));
  app.post("/pev-requests/:id/collect", async (r) =>
    service.assign(
      await actor(r),
      id(r),
      z
        .object({ collectorId: z.string().min(1).max(100).optional() })
        .strict()
        .parse(r.body || {}).collectorId,
    ),
  );
}
