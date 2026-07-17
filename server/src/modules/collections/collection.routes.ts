import { FastifyInstance } from "fastify";

import { CollectionController } from "./collection.controller";

const collectionController =
  new CollectionController();

export async function collectionRoutes(
  app: FastifyInstance
) {
  /*
   * ============================================================
   * AUTENTICAÇÃO
   * ============================================================
   */

  app.addHook(
    "preHandler",
    app.authenticate
  );

  /*
   * ============================================================
   * HEALTH CHECK DO MÓDULO
   * ============================================================
   */

  app.get("/ping", async () => {
    return {
      success: true,
      ok: true,
      module: "collections",
      timestamp: new Date().toISOString(),
    };
  });

  /*
   * ============================================================
   * CRIAÇÃO E DELEGAÇÃO DE COLETA
   * ============================================================
   *
   * POST /collections
   *
   * Permitido atualmente somente para cooperativas.
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
   * ============================================================
   * LISTAGEM DAS COLETAS DO USUÁRIO AUTENTICADO
   * ============================================================
   *
   * GET /collections
   *
   * O service aplica o filtro conforme o perfil:
   * - cooperativa;
   * - catador;
   * - motorista;
   * - gerador.
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
   * ============================================================
   * CONSULTA DE UMA COLETA
   * ============================================================
   *
   * GET /collections/:id
   */

  app.get(
    "/:id",
    (request, reply) =>
      collectionController.findById(
        request,
        reply
      )
  );

  /*
   * ============================================================
   * ATUALIZAÇÃO DE STATUS
   * ============================================================
   *
   * PATCH /collections/:id/status
   *
   * Ao receber COMPLETED:
   * - atualiza Collection;
   * - atualiza Schedule;
   * - cria CollectionMaterial;
   * - cria CollectionWasteEntry;
   * - não cria lote automaticamente.
   */

  app.patch(
    "/:id/status",
    (request, reply) =>
      collectionController.updateStatus(
        request,
        reply
      )
  );
}