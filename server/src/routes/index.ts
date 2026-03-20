import { FastifyInstance } from "fastify";
import { authRoutes } from "../modules/auth/auth.routes";
import { generatorRoutes } from "../modules/generators/generator.routes";
import { collectorRoutes } from "../modules/collectors/collector.routes";
import { scheduleRoutes } from "../modules/schedules/schedule.routes";
import { collectionRoutes } from "../modules/collections/collection.routes";
import { driverRoutes } from "../modules/drivers/driver.routes";
import { vehicleRoutes } from "../modules/vehicles/vehicle.routes";
import { routeRoutes } from "../modules/routes/route.routes";

export async function appRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "katu-server",
      timestamp: new Date().toISOString(),
    };
  });

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(generatorRoutes, { prefix: "/generators" });
  await app.register(collectorRoutes, { prefix: "/collectors" });
  await app.register(scheduleRoutes, { prefix: "/schedules" });
  await app.register(collectionRoutes, { prefix: "/collections" });
  await app.register(driverRoutes, { prefix: "/drivers" });
  await app.register(vehicleRoutes, { prefix: "/vehicles" });
  await app.register(routeRoutes, { prefix: "/routes" });
}
