import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";

import { env } from "./config/env";
import { appRoutes } from "./routes/index";
import { cooperativesRoutes } from "./modules/cooperatives/cooperatives.routes";

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
    logger: {
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

  return app;
}