import { FastifyInstance } from "fastify";

import { authRoutes } from "../modules/auth/auth.routes";
import { generatorRoutes } from "../modules/generators/generator.routes";
import { collectorRoutes } from "../modules/collectors/collector.routes";
import { scheduleRoutes } from "../modules/schedules/schedule.routes";
import { collectionRoutes } from "../modules/collections/collection.routes";
import { driverRoutes } from "../modules/drivers/driver.routes";
import { vehicleRoutes } from "../modules/vehicles/vehicle.routes";
import { routeRoutes } from "../modules/routes/route.routes";
import { wasteStockRoutes } from "../modules/waste-stock/waste-stock.routes";

export async function appRoutes(app: FastifyInstance) {
  /*
   * ============================================================
   * HEALTH CHECK
   * ============================================================
   */

  app.get("/health", async () => {
    return {
      ok: true,
      service: "katu-server",
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
   */

  await app.register(collectionRoutes, {
    prefix: "/collections",
  });

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
   * Endpoints antigos temporariamente compatíveis:
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
}