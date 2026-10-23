import { FastifyInstance } from "fastify";

import { ScheduleController } from "./schedule.controller";

const scheduleController =
  new ScheduleController();

/*
 * ============================================================
 * ROTAS DE AGENDAMENTOS
 * ============================================================
 *
 * Responsabilidade deste módulo:
 *
 * - registrar a solicitação;
 * - registrar os materiais previstos;
 * - permitir confirmação antes da delegação;
 * - permitir cancelamento enquanto não existir coleta operacional.
 *
 * O módulo Schedule não registra materiais efetivamente coletados,
 * não cria estoque e não conclui o ciclo operacional.
 *
 * IN_PROGRESS e COMPLETED continuam existindo em ScheduleStatus,
 * mas são atualizados internamente pelo módulo Collection.
 */

export async function scheduleRoutes(
  app: FastifyInstance
) {
  app.addHook(
    "preHandler",
    app.authenticate
  );

  app.get("/ping", async () => {
    return {
      success: true,
      ok: true,
      module:
        "schedules",
      architecture:
        "structured-requested-materials",
      timestamp:
        new Date().toISOString(),
    };
  });

  /*
   * POST /schedules
   *
   * Perfis:
   * - PF;
   * - GENERATOR_SMALL;
   * - GENERATOR_LARGE;
   * - COOPERATIVE.
   *
   * Cria:
   * - Schedule;
   * - ScheduleRequestedMaterial;
   * - WasteCatalogSuggestion para material não catalogado.
   *
   * Não cria:
   * - Collection;
   * - CollectionMaterial;
   * - CollectionWasteEntry;
   * - WasteStockLot.
   */
  app.post(
    "/",
    (request, reply) =>
      scheduleController.create(
        request,
        reply
      )
  );

  /*
   * GET /schedules
   */
  app.get(
    "/",
    (request, reply) =>
      scheduleController.listMine(
        request,
        reply
      )
  );

  /*
   * GET /schedules/:id
   */
  app.get(
    "/:id",
    (request, reply) =>
      scheduleController.findById(
        request,
        reply
      )
  );

  /*
   * PATCH /schedules/:id/status
   *
   * Permitido somente para COOPERATIVE.
   *
   * Atualizações manuais aceitas:
   * - SCHEDULED;
   * - CANCELLED.
   *
   * IN_PROGRESS:
   * - atualizado quando a Collection é iniciada.
   *
   * COMPLETED:
   * - atualizado quando a Collection é concluída.
   *
   * CANCELLED:
   * - permitido diretamente apenas quando não existe Collection
   *   vinculada ao fluxo operacional;
   * - quando já existe Collection, o cancelamento deve acontecer
   *   pelo módulo /collections.
   */
  app.patch(
    "/:id/status",
    (request, reply) =>
      scheduleController.updateStatus(
        request,
        reply
      )
  );
}
