import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../lib/prisma";
import { planSchema, optimizeSchema, pointSchema } from "./planning.schemas";
import { addPlannedPoints, RoutePlanningService } from "./planning.service";
import { optimizeRoad } from "./road-routing";
import { RouteService } from "./route.service";
import { RouteLifecycleService, resolutionSchema, reportSchema } from "./lifecycle.service";
const lifecycle = new RouteLifecycleService();
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
      const [generators, bins, teams, collectors] = await Promise.all([
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
        prisma.collectorTeam.findMany({ where: { cooperativeId: c.id }, orderBy: { name: "asc" } }),
        prisma.collector.findMany({
          where: { cooperativeId: c.id, status: { not: "INACTIVE" } },
          select: { id: true, name: true },
        }),
      ]);
      return {
        generators,
        bins,
        collectors,
        teams,
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
        return lifecycle.report(r.user.sub, r.user.role, r.params.id, r.params.collectionId, reportSchema.parse(r.body));
      },
      ["COOPERATIVE", "COLLECTOR", "DRIVER"],
    ),
  );
  app.post("/routes/:id/request-closure", safe(async r => lifecycle.report(r.user.sub, r.user.role, r.params.id, null, reportSchema.parse(r.body)), ["COLLECTOR", "DRIVER"]));
  app.post("/routes/:id/resolve-pending", safe(async r => lifecycle.resolve(r.user.sub, r.params.id, resolutionSchema.parse(r.body))));
  app.get("/routes/:id/point-sources",safe(async r=>{const rs=new RouteService();const route=await rs.findById(r.user.sub,r.user.role,r.params.id);if(!["SCHEDULED","IN_PROGRESS"].includes(route.status))throw Error("Esta rota já foi encerrada.");const where={cooperativeId:route.cooperativeId};const [generators,bins]=await Promise.all([prisma.generator.findMany({where,take:100,orderBy:{name:"asc"},select:{id:true,name:true,address:true,street:true,number:true,city:true,state:true,latitude:true,longitude:true}}),prisma.bin.findMany({where:{...where,status:{notIn:["INACTIVE","MAINTENANCE"]}},take:100,orderBy:{name:"asc"},select:{id:true,name:true,street:true,number:true,city:true,state:true,latitude:true,longitude:true}})]);return {generators,bins};},["COOPERATIVE","COLLECTOR","DRIVER"]));
  app.post("/routes/:id/field-points",safe(async r=>{
    const point=pointSchema.parse(r.body),rs=new RouteService();await rs.findById(r.user.sub,r.user.role,r.params.id);
    return prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Route" WHERE id=${r.params.id} FOR UPDATE`;const route=await tx.route.findUniqueOrThrow({where:{id:r.params.id},include:{cooperative:{select:{userId:true}}}});if(!["SCHEDULED","IN_PROGRESS"].includes(route.status))throw Error("A rota está encerrada.");
      if(r.user.role==="COOPERATIVE"&&route.cooperative.userId!==r.user.sub)throw Error("Sem acesso a esta rota.");
      if(r.user.role==="DRIVER"&&!(await tx.driver.findFirst({where:{id:route.driverId||"",userId:r.user.sub,cooperativeId:route.cooperativeId,status:{not:"INACTIVE"}}})))throw Error("Esta rota não está atribuída ao motorista.");
      if(r.user.role==="COLLECTOR"&&!(await tx.collector.findFirst({where:{userId:r.user.sub,cooperativeId:route.cooperativeId,id:{in:route.collectorIds},status:{not:"INACTIVE"}}})))throw Error("Esta rota não está atribuída ao catador.");
      const old=await tx.collection.findFirst({where:{routeId:route.id,routePointKey:point.key}});if(old){if(!Object.entries(point).every(([key,value])=>JSON.stringify((old.routePoint as any)?.[key])===JSON.stringify(value)))throw Error("Identificador já usado. Confira os pontos da rota.");return {collectionId:old.id,replayed:true};}
      const ids=await addPlannedPoints(tx,route,[point],route.cooperative.userId);await tx.route.update({where:{id:route.id},data:{collectionOrder:{push:ids[0]},revision:{increment:1}}});return {collectionId:ids[0],replayed:false};
    });
  },["COOPERATIVE","COLLECTOR","DRIVER"]));
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
