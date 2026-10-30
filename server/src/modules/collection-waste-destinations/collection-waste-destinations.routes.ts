import type { FastifyInstance } from "fastify";

import { CollectionWasteDestinationsController } from "./collection-waste-destinations.controller";

/*
 * ============================================================
 * CONTROLLER
 * ============================================================
 */

const collectionWasteDestinationsController =
  new CollectionWasteDestinationsController();

/*
 * ============================================================
 * ROTAS
 * ============================================================
 */

export async function collectionWasteDestinationsRoutes(
  app: FastifyInstance
) {
  /*
   * ============================================================
   * AUTENTICAÇÃO
   * ============================================================
   *
   * Todas as rotas deste módulo exigem usuário autenticado.
   */

  app.addHook(
    "preHandler",
    app.authenticate
  );

  /*
   * ============================================================
   * HEALTH CHECK DO MÓDULO
   * ============================================================
   *
   * GET /collection-waste-destinations/ping
   */

  app.get(
    "/ping",
    async () => {
      return {
        success: true,
        module:
          "collection-waste-destinations",
        message:
          "Módulo de destinação de resíduos operacional.",
        timestamp:
          new Date().toISOString(),
      };
    }
  );

  /*
   * ============================================================
   * LISTAGEM POR ENTRADA
   * ============================================================
   *
   * Deve ser registrada antes de /:id para impedir que
   * a palavra "entry" seja interpretada como um ID.
   *
   * GET /collection-waste-destinations/entry/:entryId
   */

  app.get(
    "/entry/:entryId",
    collectionWasteDestinationsController
      .listByEntry
      .bind(
        collectionWasteDestinationsController
      )
  );

  /*
   * ============================================================
   * LISTAGEM GERAL
   * ============================================================
   *
   * GET /collection-waste-destinations
   */

  app.get(
    "/",
    collectionWasteDestinationsController
      .list
      .bind(
        collectionWasteDestinationsController
      )
  );

  /*
   * ============================================================
   * CRIAR DESTINAÇÃO
   * ============================================================
   *
   * POST /collection-waste-destinations
   */

  app.post(
    "/",
    collectionWasteDestinationsController
      .create
      .bind(
        collectionWasteDestinationsController
      )
  );

  /*
   * ============================================================
   * CANCELAR DESTINAÇÃO
   * ============================================================
   *
   * Deve ser registrada antes de /:id para manter a rota
   * específica separada da rota genérica.
   *
   * POST /collection-waste-destinations/:id/cancel
   */

  app.post(
    "/:id/cancel",
    collectionWasteDestinationsController
      .cancel
      .bind(
        collectionWasteDestinationsController
      )
  );

  /*
   * ============================================================
   * CONSULTAR DESTINAÇÃO POR ID
   * ============================================================
   *
   * GET /collection-waste-destinations/:id
   */

  app.get(
    "/:id",
    collectionWasteDestinationsController
      .findById
      .bind(
        collectionWasteDestinationsController
      )
  );

  /*
   * ============================================================
   * ATUALIZAR DADOS COMPLEMENTARES
   * ============================================================
   *
   * PATCH /collection-waste-destinations/:id
   */

  app.patch(
    "/:id",
    collectionWasteDestinationsController
      .update
      .bind(
        collectionWasteDestinationsController
      )
  );
}