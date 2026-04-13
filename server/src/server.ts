import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Recebido sinal ${signal}. Encerrando KATU API...`);

    try {
      await app.close();
      await prisma.$disconnect();
      app.log.info("KATU API encerrada com sucesso.");
      process.exit(0);
    } catch (error) {
      app.log.error(error, "Erro ao encerrar aplicação.");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await prisma.$connect();

    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    app.log.info(`KATU server running on port ${env.PORT}`);
  } catch (error) {
    app.log.error(error, "Falha ao iniciar KATU API.");
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

void start();