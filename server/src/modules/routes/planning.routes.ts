import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../lib/prisma";
import { planSchema, optimizeSchema } from "./planning.schemas";
import { RoutePlanningService } from "./planning.service";
import { optimizeRoad } from "./road-routing";
import { RouteService } from "./route.service";
const service = new RoutePlanningService();
export async function routePlanningRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  const requests = new Map<string, { count: number; until: number }>();
  const safe =
    (fn: (req: any) => Promise<unknown>, roles = ["COOPERATIVE"]) =>
    async (req: any, reply: any) => {
      try {
        if (!roles.includes(req.user.role))
          return reply
            .code(403)
            .send({ error: "Sem permissão para esta operação." });
        return await fn(req);
      } catch (e: any) {
        return reply.code(e.code === "P2034" ? 409 : 400).send({
          error:
            e instanceof ZodError
              ? e.issues.map((i) => i.message).join(" ")
              : e.code
                ? "A operação não foi concluída. Atualize os dados e tente novamente."
                : e.message,
        });
      }
    };
  app.get(
    "/route-plans",
    safe(async (r) => ({ plans: await service.list(r.user.sub) })),
  );
  app.post(
    "/route-plans",
    safe(async (r) => ({
      plan: await service.save(r.user.sub, planSchema.parse(r.body)),
    })),
  );
  app.patch(
    "/route-plans/:id",
    safe(async (r) => ({
      plan: await service.save(
        r.user.sub,
        planSchema.parse(r.body),
        r.params.id,
      ),
    })),
  );
  app.post(
    "/route-plans/:id/generate",
    safe(async (r) => {
      const coop = await service.coop(r.user.sub);
      if (
        !(await prisma.routePlan.findFirst({
          where: { id: r.params.id, cooperativeId: coop.id },
        }))
      )
        throw Error("Roteiro não encontrado.");
      await service.generate(r.params.id);
      return { plans: await service.list(r.user.sub) };
    }),
  );
  app.post(
    "/route-planning/optimize",
    safe(async (r) => {
      const input = optimizeSchema.parse(r.body),
        now = Date.now();
      if (requests.size > 1000)
        for (const [key, value] of requests)
          if (value.until < now) requests.delete(key);
      let window = requests.get(r.user.sub);
      if (!window || window.until < now) {
        window = { count: 0, until: now + 60000 };
        requests.set(r.user.sub, window);
      }
      if (++window.count > 10)
        throw Error("Aguarde um minuto antes de solicitar novos cálculos.");
      return optimizeRoad(input);
    }),
  );
  app.get(
    "/route-planning/sources",
    safe(async (r) => {
      const c = await service.coop(r.user.sub);
      const [generators, bins, collectors] = await Promise.all([
        prisma.generator.findMany({
          where: { cooperativeId: c.id },
          select: {
            id: true,
            name: true,
            companyName: true,
            address: true,
            street: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            zipCode: true,
            latitude: true,
            longitude: true,
          },
        }),
        prisma.bin.findMany({
          where: {
            cooperativeId: c.id,
            status: { notIn: ["INACTIVE", "MAINTENANCE"] },
          },
          select: {
            id: true,
            name: true,
            binId: true,
            street: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            zipCode: true,
            latitude: true,
            longitude: true,
          },
        }),
        prisma.collector.findMany({
          where: { cooperativeId: c.id, status: { not: "INACTIVE" } },
          select: { id: true, name: true },
        }),
      ]);
      return {
        generators,
        bins,
        collectors,
        base: {
          name: c.name,
          address: c.address || "Sede da cooperativa",
          latitude: c.latitude,
          longitude: c.longitude,
        },
      };
    }),
  );
  app.post(
    "/routes/:id/visits/:collectionId/occurrence",
    safe(
      async (r) => {
        const { reason } = z
          .object({ reason: z.string().trim().min(5).max(1000) })
          .parse(r.body);
        return service.occurrence(
          r.user.sub,
          r.user.role,
          r.params.id,
          r.params.collectionId,
          reason,
        );
      },
      ["COOPERATIVE", "COLLECTOR", "DRIVER"],
    ),
  );
  app.post(
    "/routes/:id/field-status",
    safe(
      async (r) => {
        const { status } = z
          .object({ status: z.enum(["IN_PROGRESS", "COMPLETED"]) })
          .parse(r.body);
        const rs = new RouteService();
        await rs.findById(r.user.sub, r.user.role, r.params.id);
        const route = await prisma.route.findUniqueOrThrow({
          where: { id: r.params.id },
          include: { cooperative: { select: { userId: true } } },
        });
        return {
          route: await rs.updateStatus(
            route.cooperative.userId,
            route.id,
            { status },
            r.user,
          ),
        };
      },
      ["COLLECTOR", "DRIVER"],
    ),
  );
}
