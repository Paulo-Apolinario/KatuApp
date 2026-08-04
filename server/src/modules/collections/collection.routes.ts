import { FastifyInstance } from "fastify";

import { CollectionController } from "./collection.controller";

const collectionController =
  new CollectionController();

export async function collectionRoutes(
  app: FastifyInstance
) {
  app.addHook(
    "preHandler",
    app.authenticate
  );

  app.get("/ping", async () => ({
    success: true,
    ok: true,
    module: "collections",
    architecture:
      "operational-collection-lifecycle",
    statuses: [
      "PENDING",
      "IN_PROGRESS",
      "COLLECTED",
      "RECEIVED",
      "SORTING",
      "COMPLETED",
      "CANCELLED",
    ],
    timestamp: new Date().toISOString(),
  }));

  /*
   * COOPERATIVE
   * Schedule -> Collection PENDING
   */
  app.post(
    "/",
    (request, reply) =>
      collectionController.create(
        request,
        reply
      )
  );

  /*
   * Todos os perfis autorizados pelo service.
   */
  app.get(
    "/",
    (request, reply) =>
      collectionController.listMine(
        request,
        reply
      )
  );

  /*
   * COLLECTOR
   * PENDING -> IN_PROGRESS
   */
  app.post(
    "/:id/start",
    (request, reply) =>
      collectionController.start(
        request,
        reply
      )
  );

  /*
   * COLLECTOR
   * IN_PROGRESS -> COLLECTED
   *
   * Cria:
   * - CollectionMaterial;
   * - CollectionWasteEntry;
   * - WasteCatalogSuggestion para materiais desconhecidos.
   */
  app.post(
    "/:id/complete-field",
    (request, reply) =>
      collectionController.completeField(
        request,
        reply
      )
  );

  /*
   * COOPERATIVE
   * COLLECTED -> RECEIVED
   */
  app.post(
    "/:id/receive",
    (request, reply) =>
      collectionController.receive(
        request,
        reply
      )
  );

  /*
   * COOPERATIVE
   * RECEIVED -> SORTING
   */
  app.post(
    "/:id/start-sorting",
    (request, reply) =>
      collectionController.startSorting(
        request,
        reply
      )
  );

  /*
   * COOPERATIVE
   * SORTING -> COMPLETED
   *
   * Exige remainingQuantity = 0 em todas as entradas.
   */
  app.post(
    "/:id/complete",
    (request, reply) =>
      collectionController.complete(
        request,
        reply
      )
  );

  /*
   * COOPERATIVE
   */
  app.post(
    "/:id/cancel",
    (request, reply) =>
      collectionController.cancel(
        request,
        reply
      )
  );

  /*
   * Compatibilidade temporária.
   */
  app.patch(
    "/:id/status",
    (request, reply) =>
      collectionController.updateStatus(
        request,
        reply
      )
  );

  app.get(
    "/:id",
    (request, reply) =>
      collectionController.findById(
        request,
        reply
      )
  );
}
