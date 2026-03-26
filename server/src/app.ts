import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import jwt from "@fastify/jwt";

import { env } from "./config/env";
import { appRoutes } from "./routes/index";
import { cooperativesRoutes } from "./modules/cooperatives/cooperatives.routes";


export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
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
    } catch (error) {
      return reply.unauthorized("Token inválido ou ausente.");
    }
  });

  await app.register(appRoutes);
  await app.register(cooperativesRoutes);

  return app;
}
