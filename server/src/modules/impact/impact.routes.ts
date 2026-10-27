import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../lib/prisma";
import { period, querySchema } from "../reports/reports.schemas";
import { buildCharts, emptyConfig } from "../reports/reports.model";
export async function impactRoutes(app: FastifyInstance) {
  app.get(
    "/environmental-impact",
    { preHandler: [app.authenticate] },
    async (r, reply) => {
      try {
        const input = z
          .object({
            start: z.string(),
            end: z.string(),
            generatorId: z.string().max(100).optional(),
          })
          .strict()
          .parse(r.query);
        const q = querySchema.parse({
          start: input.start,
          end: input.end,
          dateBasis: "completedAt",
        });
        const u = await prisma.user.findUniqueOrThrow({
          where: { id: r.user.sub },
          include: {
            cooperative: { select: { id: true } },
            generator: { select: { id: true, cooperativeId: true } },
          },
        });
        const owner = u.role === "COOPERATIVE";
        if (!owner && !["GENERATOR_SMALL", "GENERATOR_LARGE"].includes(u.role))
          return reply
            .code(403)
            .send({ error: "Perfil sem acesso ao impacto dos geradores." });
        const coop = owner ? u.cooperative?.id : u.generator?.cooperativeId;
        const gen = owner ? input.generatorId : u.generator?.id;
        if (
          !coop ||
          (!owner && !gen) ||
          (!owner && input.generatorId && input.generatorId !== gen)
        )
          return reply
            .code(403)
            .send({ error: "Sem vínculo para consultar este impacto." });
        const output = await prisma.$transaction(
          async (tx) => {
            if (
              gen &&
              !(await tx.generator.findFirst({
                where: { id: gen, cooperativeId: coop },
                select: { id: true },
              }))
            )
              return null;
            const cfg = await tx.reportConfiguration.findUnique({
              where: { cooperativeId: coop },
            });
            const config = (cfg?.payload as any) || emptyConfig;
            const collections = await tx.collection.findMany({
              where: {
                cooperativeId: coop,
                generatorId: gen || { not: null },
                status: "COMPLETED",
                completedAt: period(q),
              },
              select: {
                id: true,
                status: true,
                totalWeightKg: true,
                completedAt: true,
                generatorId: true,
                binId: true,
                generator: {
                  select: {
                    id: true,
                    name: true,
                    companyName: true,
                    city: true,
                    latitude: true,
                    longitude: true,
                  },
                },
                bin: {
                  select: {
                    id: true,
                    name: true,
                    city: true,
                    latitude: true,
                    longitude: true,
                  },
                },
                collectionMaterials: {
                  select: {
                    id: true,
                    wasteTypeId: true,
                    nameSnapshot: true,
                    categorySnapshot: true,
                    unit: true,
                    quantity: true,
                  },
                },
              },
              take: 20001,
            });
            if (collections.length > 20000)
              throw Error(
                "Reduza o período: o recorte ultrapassa 20 mil coletas.",
              );
            const grouped = new Map<string, typeof collections>();
            for (const c of collections)
              grouped.set(c.generatorId!, [
                ...(grouped.get(c.generatorId!) || []),
                c,
              ]);
            const environmental = buildCharts(
              collections,
              q,
              config,
            ).environmental;
            return {
              start: q.start,
              end: q.end,
              basis: "Conclusão operacional",
              collections: collections.length,
              ...environmental,
              coveragePercent: environmental.totalMassKg
                ? (environmental.coveredMassKg / environmental.totalMassKg) *
                  100
                : 0,
              materials: buildCharts(collections, q, config).materialTotals,
              generators: [...grouped].map(([id, cs]) => ({
                id,
                name:
                  cs[0].generator?.companyName ||
                  cs[0].generator?.name ||
                  "Gerador",
                collections: cs.length,
                ...buildCharts(cs, q, config).environmental,
              })),
            };
          },
          { isolationLevel: "RepeatableRead", timeout: 30000 },
        );
        if (!output)
          return reply
            .code(404)
            .send({ error: "Gerador não encontrado nesta cooperativa." });
        reply.header("Cache-Control", "private, no-store");
        return { data: output };
      } catch (e: any) {
        if (e instanceof ZodError)
          return reply.code(400).send({ error: e.issues[0]?.message });
        r.log.error({ code: e.code }, "Falha no impacto ambiental");
        return reply
          .code(422)
          .send({
            error: e.message?.startsWith("Reduza")
              ? e.message
              : "Não foi possível consultar o impacto ambiental.",
          });
      }
    },
  );
}
