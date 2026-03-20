import { buildApp } from "./app";
import { env } from "./config/env";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    console.log(`🚀 KATU server running on port ${env.PORT}`);
    console.log(app.printRoutes());
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
