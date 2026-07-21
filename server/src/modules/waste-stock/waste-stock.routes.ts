import { FastifyInstance } from "fastify";

import { WasteStockController } from "./waste-stock.controller";

const wasteStockController =
  new WasteStockController();

export async function wasteStockRoutes(
  app: FastifyInstance
) {
  app.addHook(
    "preHandler",
    app.authenticate
  );

  /*
   * ============================================================
   * VERIFICAÇÃO DO MÓDULO
   * ============================================================
   */

  app.get("/ping", async () => {
    return {
      success: true,
      ok: true,
      module: "waste-stock",
      architecture:
        "catalog-and-stock-separated",
      timestamp:
        new Date().toISOString(),
    };
  });

  /*
   * ============================================================
   * CATÁLOGO PARA CONSULTA
   * ============================================================
   *
   * Endpoint de leitura utilizado pelo App e por outros clientes.
   *
   * Perfis permitidos:
   * - PF, informando cooperativeId;
   * - GENERATOR_SMALL;
   * - GENERATOR_LARGE;
   * - COOPERATIVE.
   *
   * Retorna somente materiais ativos e não expõe lotes ou saldos.
   */

  app.get(
    "/catalog",
    (request, reply) =>
      wasteStockController.listCatalog(
        request,
        reply
      )
  );

  /*
   * ============================================================
   * CATÁLOGO ADMINISTRATIVO DE TIPOS DE RESÍDUOS
   * ============================================================
   *
   * Cada cooperativa administra seus próprios materiais.
   */

  app.get(
    "/items",
    (request, reply) =>
      wasteStockController.listItems(
        request,
        reply
      )
  );

  app.post(
    "/items",
    (request, reply) =>
      wasteStockController.createItem(
        request,
        reply
      )
  );

  app.get(
    "/items/:id",
    (request, reply) =>
      wasteStockController.findItemById(
        request,
        reply
      )
  );

  app.put(
    "/items/:id",
    (request, reply) =>
      wasteStockController.updateItem(
        request,
        reply
      )
  );

  app.patch(
    "/items/:id",
    (request, reply) =>
      wasteStockController.updateItem(
        request,
        reply
      )
  );

  app.delete(
    "/items/:id",
    (request, reply) =>
      wasteStockController.deactivateItem(
        request,
        reply
      )
  );

  /*
   * ============================================================
   * LOTES DE ESTOQUE
   * ============================================================
   */

  app.get(
    "/items/:id/lots",
    (request, reply) =>
      wasteStockController.listLots(
        request,
        reply
      )
  );

  app.post(
    "/items/:id/lots",
    (request, reply) =>
      wasteStockController.createLot(
        request,
        reply
      )
  );

  app.put(
    "/lots/:lotId",
    (request, reply) =>
      wasteStockController.updateLot(
        request,
        reply
      )
  );

  app.patch(
    "/lots/:lotId",
    (request, reply) =>
      wasteStockController.updateLot(
        request,
        reply
      )
  );

  app.delete(
    "/lots/:lotId",
    (request, reply) =>
      wasteStockController.discardLot(
        request,
        reply
      )
  );

  /*
   * ============================================================
   * ROTAS DE COMPATIBILIDADE TEMPORÁRIA
   * ============================================================
   *
   * Estas rotas mantêm o frontend atual funcionando durante a
   * transição para as novas telas separadas.
   *
   * Serão removidas somente depois que Web, App, relatórios e
   * Analytics estiverem utilizando os novos endpoints.
   */

  app.get(
    "/",
    (request, reply) =>
      wasteStockController.listMine(
        request,
        reply
      )
  );

  app.post(
    "/",
    (request, reply) =>
      wasteStockController.create(
        request,
        reply
      )
  );

  app.get(
    "/:id",
    (request, reply) =>
      wasteStockController.findById(
        request,
        reply
      )
  );

  app.put(
    "/:id",
    (request, reply) =>
      wasteStockController.update(
        request,
        reply
      )
  );

  app.patch(
    "/:id",
    (request, reply) =>
      wasteStockController.update(
        request,
        reply
      )
  );

  app.delete(
    "/:id",
    (request, reply) =>
      wasteStockController.delete(
        request,
        reply
      )
  );

  app.get(
    "/:id/lots",
    (request, reply) =>
      wasteStockController.listLots(
        request,
        reply
      )
  );

  app.post(
    "/:id/lots",
    (request, reply) =>
      wasteStockController.createLot(
        request,
        reply
      )
  );
}
