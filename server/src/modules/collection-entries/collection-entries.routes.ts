import { FastifyInstance } from "fastify";

import { CollectionEntriesController } from "./collection-entries.controller";

/*
 * ============================================================
 * CONTROLLER
 * ============================================================
 */

const collectionEntriesController =
  new CollectionEntriesController();

/*
 * ============================================================
 * ROTAS
 * ============================================================
 */

export async function collectionEntriesRoutes(
  app: FastifyInstance
) {
  /*
   * ============================================================
   * AUTENTICAÇÃO
   * ============================================================
   *
   * Todas as rotas deste módulo exigem JWT válido.
   */

  app.addHook(
    "preHandler",
    app.authenticate
  );

  /*
   * ============================================================
   * HEALTH CHECK
   * ============================================================
   *
   * GET /collection-entries/ping
   */

  app.get("/ping", async () => {
    return {
      success: true,
      ok: true,
      module: "collection-entries",
      timestamp: new Date().toISOString(),
    };
  });

  /*
   * ============================================================
   * RESUMO OPERACIONAL
   * ============================================================
   *
   * GET /collection-entries/summary
   *
   * Importante:
   * esta rota precisa ser declarada antes de "/:id".
   */

  app.get(
    "/summary",
    (request, reply) =>
      collectionEntriesController.summary(
        request,
        reply
      )
  );

  /*
   * ============================================================
   * ENTRADAS PENDENTES
   * ============================================================
   *
   * GET /collection-entries/pending
   *
   * Retorna apenas entradas:
   *
   * - com remainingQuantity > 0;
   * - não canceladas;
   * - ainda não totalmente destinadas.
   */

  app.get(
    "/pending",
    (request, reply) =>
      collectionEntriesController.listPending(
        request,
        reply
      )
  );

  /*
   * ============================================================
   * LISTAGEM GERAL
   * ============================================================
   *
   * GET /collection-entries
   *
   * Aceita filtros como:
   *
   * - status;
   * - wasteTypeId;
   * - collectionId;
   * - generatorId;
   * - collectorId;
   * - driverId;
   * - vehicleId;
   * - routeId;
   * - unit;
   * - search;
   * - dateFrom;
   * - dateTo;
   * - onlyWithBalance;
   * - page;
   * - limit.
   */

  app.get(
    "/",
    (request, reply) =>
      collectionEntriesController.list(
        request,
        reply
      )
  );

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   *
   * GET /collection-entries/:id
   *
   * Deve permanecer depois de:
   *
   * - /summary
   * - /pending
   *
   * para evitar que o Fastify interprete esses nomes como IDs.
   */

  app.get(
    "/:id",
    (request, reply) =>
      collectionEntriesController.findById(
        request,
        reply
      )
  );
}