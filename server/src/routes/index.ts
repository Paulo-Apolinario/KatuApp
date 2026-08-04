import type { FastifyInstance } from "fastify";

import { authRoutes } from "../modules/auth/auth.routes";
import { generatorRoutes } from "../modules/generators/generator.routes";
import { collectorRoutes } from "../modules/collectors/collector.routes";
import { scheduleRoutes } from "../modules/schedules/schedule.routes";
import { collectionRoutes } from "../modules/collections/collection.routes";
import { collectionEntriesRoutes } from "../modules/collection-entries/collection-entries.routes";
import { collectionWasteDestinationsRoutes } from "../modules/collection-waste-destinations/collection-waste-destinations.routes";
import { driverRoutes } from "../modules/drivers/driver.routes";
import { vehicleRoutes } from "../modules/vehicles/vehicle.routes";
import { routeRoutes } from "../modules/routes/route.routes";
import { wasteStockRoutes } from "../modules/waste-stock/waste-stock.routes";

export async function appRoutes(
  app: FastifyInstance
) {
  /*
   * ============================================================
   * HEALTH CHECK
   * ============================================================
   */

  app.get("/health", async () => {
    return {
      ok: true,
      service: "katu-server",
      version: "2.0",
      timestamp: new Date().toISOString(),
    };
  });

  /*
   * ============================================================
   * AUTENTICAÇÃO
   * ============================================================
   */

  await app.register(authRoutes, {
    prefix: "/auth",
  });

  /*
   * ============================================================
   * GERADORES
   * ============================================================
   */

  await app.register(generatorRoutes, {
    prefix: "/generators",
  });

  /*
   * ============================================================
   * CATADORES
   * ============================================================
   */

  await app.register(collectorRoutes, {
    prefix: "/collectors",
  });

  /*
   * ============================================================
   * AGENDAMENTOS
   * ============================================================
   */

  await app.register(scheduleRoutes, {
    prefix: "/schedules",
  });

  /*
   * ============================================================
   * COLETAS
   * ============================================================
   *
   * Responsável pelo ciclo operacional da coleta.
   *
   * Fluxo:
   *
   * Solicitação
   * ↓
   * Agendamento
   * ↓
   * Delegação
   * ↓
   * Execução
   * ↓
   * Conclusão
   *
   * Ao concluir uma coleta, o backend deverá criar:
   *
   * ✓ Collection
   * ✓ CollectionMaterial
   * ✓ CollectionWasteEntry
   *
   * A conclusão da coleta não cria lote de estoque
   * automaticamente.
   */

  await app.register(collectionRoutes, {
    prefix: "/collections",
  });

  /*
   * ============================================================
   * RESÍDUOS COLETADOS
   * ============================================================
   *
   * Módulo intermediário entre a coleta concluída e a
   * destinação do material.
   *
   * Responsável por consultar todos os resíduos coletados,
   * incluindo os resíduos que ainda não foram destinados.
   *
   * Fluxo:
   *
   * Collection
   * ↓
   * CollectionMaterial
   * ↓
   * CollectionWasteEntry
   *
   * Principais endpoints:
   *
   * GET /collection-entries/ping
   * GET /collection-entries
   * GET /collection-entries/pending
   * GET /collection-entries/summary
   * GET /collection-entries/:id
   */

  await app.register(
    collectionEntriesRoutes,
    {
      prefix: "/collection-entries",
    }
  );

  /*
   * ============================================================
   * DESTINAÇÃO DOS RESÍDUOS COLETADOS
   * ============================================================
   *
   * Responsável por registrar o destino dado a cada entrada
   * de resíduo coletado.
   *
   * Possíveis destinos:
   *
   * • Estoque
   * • Triagem
   * • Rejeito
   * • Descarte
   * • Destinação direta
   * • Reserva
   *
   * Fluxo:
   *
   * CollectionWasteEntry
   * ↓
   * CollectionWasteDestination
   * ↓
   * WasteStockLot, quando o destino for STOCK
   *
   * Regras:
   *
   * • Uma entrada pode receber mais de uma destinação.
   * • A quantidade destinada não pode ultrapassar o saldo.
   * • O lote somente é criado quando o tipo for STOCK.
   * • O cancelamento devolve a quantidade ao saldo da entrada.
   * • Quantidade, unidade e tipo não são editados diretamente.
   *
   * Principais endpoints:
   *
   * GET   /collection-waste-destinations/ping
   * GET   /collection-waste-destinations
   * POST  /collection-waste-destinations
   * GET   /collection-waste-destinations/entry/:entryId
   * GET   /collection-waste-destinations/:id
   * PATCH /collection-waste-destinations/:id
   * POST  /collection-waste-destinations/:id/cancel
   */

  await app.register(
    collectionWasteDestinationsRoutes,
    {
      prefix:
        "/collection-waste-destinations",
    }
  );

  /*
   * ============================================================
   * MOTORISTAS
   * ============================================================
   */

  await app.register(driverRoutes, {
    prefix: "/drivers",
  });

  /*
   * ============================================================
   * VEÍCULOS
   * ============================================================
   */

  await app.register(vehicleRoutes, {
    prefix: "/vehicles",
  });

  /*
   * ============================================================
   * ROTAS OPERACIONAIS
   * ============================================================
   */

  await app.register(routeRoutes, {
    prefix: "/routes",
  });

  /*
   * ============================================================
   * GESTÃO E ESTOQUE DE RESÍDUOS
   * ============================================================
   *
   * Este módulo administra:
   *
   * • Catálogo de resíduos
   * • Tipos de resíduos
   * • Lotes
   * • Saldo disponível
   * • Estado dos lotes
   *
   * Os lotes não são criados automaticamente durante
   * a conclusão de uma coleta.
   *
   * O fluxo correto é:
   *
   * Collection
   * ↓
   * CollectionMaterial
   * ↓
   * CollectionWasteEntry
   * ↓
   * CollectionWasteDestination
   * ↓
   * WasteStockLot
   *
   * Um WasteStockLot somente será criado quando uma
   * CollectionWasteDestination possuir o tipo STOCK.
   *
   * Endpoints do catálogo:
   *
   * GET    /waste-stock/items
   * POST   /waste-stock/items
   * GET    /waste-stock/items/:id
   * PUT    /waste-stock/items/:id
   * PATCH  /waste-stock/items/:id
   * DELETE /waste-stock/items/:id
   *
   * Endpoints dos lotes:
   *
   * GET    /waste-stock/items/:id/lots
   * POST   /waste-stock/items/:id/lots
   * PUT    /waste-stock/lots/:lotId
   * PATCH  /waste-stock/lots/:lotId
   * DELETE /waste-stock/lots/:lotId
   *
   * Compatibilidade temporária:
   *
   * GET    /waste-stock
   * POST   /waste-stock
   * GET    /waste-stock/:id
   * PUT    /waste-stock/:id
   * PATCH  /waste-stock/:id
   * DELETE /waste-stock/:id
   */

  await app.register(wasteStockRoutes, {
    prefix: "/waste-stock",
  });

  /*
   * ============================================================
   * FLUXO NORMALIZADO DE RESÍDUOS
   * ============================================================
   *
   * Collection
   * ↓
   * CollectionMaterial
   * ↓
   * CollectionWasteEntry
   * ↓
   * CollectionWasteDestination
   * ↓
   * WasteStockLot
   *
   * Compatibilidade temporária mantida:
   *
   * • Collection.materials
   * • Collection.totalWeightKg
   * • WasteStockLot.quantityKg
   */

  /*
   * ============================================================
   * FUTUROS MÓDULOS
   * ============================================================
   *
   * waste-reports
   * analytics
   * inventory-movements
   * waste-triage
   * environmental-documents
   * marketplace
   *
   * Estes módulos serão registrados aqui conforme forem
   * implementados.
   */
}