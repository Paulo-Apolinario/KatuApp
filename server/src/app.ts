import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";

import { env } from "./config/env";
import { appRoutes } from "./routes/index";
import { cooperativesRoutes } from "./modules/cooperatives/cooperatives.routes";
import { feedbackRoutes } from "./modules/feedback/feedback.routes";
import { wasteStockRoutes } from "./modules/waste-stock/waste-stock.routes";
import { binsRoutes } from "./modules/bins/bins.routes";
import { vehicleDocumentsRoutes } from "./modules/vehicle-documents/vehicle-documents.routes";
import { maintenanceLogsRoutes } from "./modules/maintenance-logs/maintenance-logs.routes";

function parseCorsOrigins(origins: string): string[] | boolean {
  if (!origins || origins.trim() === "*") return true;

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

  await app.register(cors, {
    origin: (origin, callback) => {
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

  await app.register(sensible);

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
    fields: 40,
    parts: 50,
  },
});

  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
  });

  app.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.unauthorized("Token inválido ou ausente.");
    }
  });

  app.get("/", async () => {
    return {
      status: "ok",
      service: "KATU API",
      environment: env.APP_ENV,
      nodeEnv: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  });

  await app.register(appRoutes);
  await app.register(cooperativesRoutes);
  await app.register(feedbackRoutes);
  await app.register(wasteStockRoutes);
  await app.register(binsRoutes);
  await app.register(vehicleDocumentsRoutes);
  await app.register(maintenanceLogsRoutes);

  return app;
}