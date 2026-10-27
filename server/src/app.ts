import { impactRoutes } from "./modules/impact/impact.routes";
import { collectorTeamRoutes } from "./modules/collector-teams/team.routes";
import { pevRequestRoutes } from "./modules/pev-requests/pev-request.routes";
import { routePlanningRoutes } from "./modules/routes/planning.routes";
import { inboxRoutes } from "./modules/inbox/inbox.routes";
import { ownerDocumentsRoutes } from "./modules/owner-documents/owner-documents.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { reportsRoutes } from "./modules/reports/reports.routes";
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";

import { prisma } from "./lib/prisma";
import { env } from "./config/env";
import { appRoutes } from "./routes/index";
import { cooperativesRoutes } from "./modules/cooperatives/cooperatives.routes";
import { feedbackRoutes } from "./modules/feedback/feedback.routes";
import { environmentalRoutes } from "./modules/environmental/environmental.routes";
import { binsRoutes } from "./modules/bins/bins.routes";
import { vehicleDocumentsRoutes } from "./modules/vehicle-documents/vehicle-documents.routes";
import { maintenanceLogsRoutes } from "./modules/maintenance-logs/maintenance-logs.routes";

function parseCorsOrigins(origins: string): string[] | boolean {
  if (!origins || origins.trim() === "*") {
    return true;
  }

  return origins
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function buildApp() {
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? {
            level: env.LOG_LEVEL,
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            },
          }
        : {
            level: env.LOG_LEVEL,
          },

    trustProxy: true,
  });

  /*
   * ============================================================
   * CORS
   * ============================================================
   */

  await app.register(cors, {
    origin: (origin, callback) => {
      /*
       * Permite:
       * - chamadas sem header Origin;
       * - todos os domínios quando CORS_ORIGIN for "*";
       * - somente os domínios configurados no ambiente.
       */
      if (allowedOrigins === true || !origin) {
        callback(null, true);
        return;
      }

      if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não permitida pelo CORS."), false);
    },

    credentials: true,
  });

  /*
   * ============================================================
   * PLUGINS GERAIS
   * ============================================================
   */

  await app.register(sensible);

  await app.register(jwt, {
    secret: env.JWT_SECRET,

    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  /*
   * Upload de arquivos.
   *
   * Configuração utilizada por:
   * - documentos dos catadores;
   * - documentos dos veículos;
   * - fotos de PEVs;
   * - manutenções;
   * - demais módulos multipart.
   */
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 10,
      fields: 40,
      parts: 50,
    },
  });

  /*
   * Disponibiliza publicamente os arquivos gravados na pasta:
   *
   * server/uploads
   *
   * Exemplo:
   * /uploads/collectors/documento.pdf
   */
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
  });

  /*
   * ============================================================
   * AUTENTICAÇÃO
   * ============================================================
   */

  app.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: {
          role: true,
          isActive: true,
          accountStatus: true,
          authVersion: true,
        },
      });
      if (
        !user ||
        !user.isActive ||
        user.accountStatus !== "ACTIVE" ||
        user.role !== request.user.role ||
        (request.user.authVersion ?? 0) !== user.authVersion
      )
        return reply.unauthorized(
          "Sessão desatualizada ou conta inativa. Entre novamente.",
        );
      const route = request.routeOptions.url || "";
      if (
        user.role === "MUNICIPAL_MANAGER" &&
        !route.startsWith("/environmental/") &&
        !(route === "/auth/me" && request.method === "GET")
      )
        return reply.forbidden(
          "Perfil municipal restrito à central ambiental.",
        );
    } catch {
      return reply.unauthorized("Token inválido ou ausente.");
    }
  });

  /*
   * ============================================================
   * ROTA RAIZ
   * ============================================================
   */

  app.get("/", async () => {
    return {
      status: "ok",
      service: "KATU API",
      environment: env.APP_ENV,
      nodeEnv: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  });

  /*
   * ============================================================
   * ROTAS PRINCIPAIS
   * ============================================================
   *
   * O wasteStockRoutes agora é registrado dentro do appRoutes,
   * com o prefixo oficial /waste-stock.
   *
   * Não registrar wasteStockRoutes novamente neste arquivo.
   */

  await app.register(appRoutes);
  await app.register(inboxRoutes);
  await app.register(routePlanningRoutes);

  /*
   * ============================================================
   * MÓDULOS REGISTRADOS FORA DO appRoutes
   * ============================================================
   *
   * Estes módulos ainda possuem suas próprias rotas/prefixos
   * internamente. Por isso permanecem registrados diretamente.
   */

  await app.register(cooperativesRoutes);
  await app.register(feedbackRoutes);
  await app.register(binsRoutes);
  await app.register(pevRequestRoutes);
  await app.register(collectorTeamRoutes);
  await app.register(impactRoutes);
  await app.register(environmentalRoutes);
  await app.register(reportsRoutes);
  await app.register(settingsRoutes);
  await app.register(dashboardRoutes);
  await app.register(vehicleDocumentsRoutes);
  await app.register(ownerDocumentsRoutes);
  await app.register(maintenanceLogsRoutes);

  return app;
}
