import { FastifyInstance } from "fastify";

import { CollectorController } from "./collector.controller";

const collectorController = new CollectorController();

export async function collectorRoutes(app: FastifyInstance) {
  /*
   * Todas as rotas deste módulo exigem autenticação.
   */
  app.addHook("preHandler", app.authenticate);

  /*
   * Rota simples para verificar se o módulo está registrado.
   */
  app.get("/ping", async () => {
    return {
      success: true,
      ok: true,
      module: "collectors",
    };
  });

  /*
   * Catadores
   */
  app.post("/", (request, reply) =>
    collectorController.create(request, reply)
  );

  app.get("/", (request, reply) =>
    collectorController.listMine(request, reply)
  );

  app.get("/:id", (request, reply) =>
    collectorController.findById(request, reply)
  );

  app.patch("/:id/status", (request, reply) =>
    collectorController.updateStatus(request, reply)
  );

  /*
   * Documentos do catador
   */
  app.post("/:id/documents", (request, reply) =>
    collectorController.addDocument(request, reply)
  );

  app.get("/:id/documents", (request, reply) =>
    collectorController.listDocuments(request, reply)
  );

  app.delete(
    "/:id/documents/:documentId",
    (request, reply) =>
      collectorController.deleteDocument(request, reply)
  );
}