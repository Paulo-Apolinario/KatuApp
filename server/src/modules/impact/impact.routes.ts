import { impactOverview, ImpactAccessError } from "./impact-summary.service";
import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../lib/prisma";
import { period, querySchema } from "../reports/reports.schemas";
import { emptyConfig, EXECUTED } from "../reports/reports.model";
import { impactSummary, monthlyImpact } from "./impact.model";
export async function impactRoutes(app: FastifyInstance) {
  app.get(
    "/environmental-impact",
    { preHandler: [app.authenticate] },
    async (r, reply) => {
      try {
        const input = z
          .object({
            year: z.coerce.number().int().min(2000).max(2100).optional(),
            start: z.string().optional(),
            end: z.string().optional(),
            generatorId: z.string().min(1).max(100).optional(),
          })
          .strict()
          .parse(r.query);
        if (
          (input.start && !input.end) ||
          (input.end && !input.start) ||
          (input.year && input.start)
        )
          return reply
            .code(400)
            .send({ error: "Informe um ano ou um período completo." });
        if (!input.year && !input.start && !input.end) {
          const data = await impactOverview(r.user.sub, input.generatorId);
          reply.header("Cache-Control", "private, no-store");
          return { data };
        }
        const year =
          input.year ??
          (input.start
            ? Number(input.start.slice(0, 4))
            : Number(
                new Date(Date.now() - 10800000).toISOString().slice(0, 4),
              ));
        const q = querySchema.parse({
          start: input.start || `${year}-01-01`,
          end: input.end || `${year}-12-31`,
          dateBasis: "collectedAt",
        });
        const range = period(q);
        const u = await prisma.user.findUniqueOrThrow({
          where: { id: r.user.sub },
          include: {
            cooperative: { select: { id: true } },
            generator: { select: { id: true, cooperativeId: true } },
            collector: {
              select: { id: true, cooperativeId: true, status: true },
            },
          },
        });
        const owner = u.role === "COOPERATIVE",
          cat = u.role === "COLLECTOR";
        if (
          !owner &&
          !cat &&
          !["GENERATOR_SMALL", "GENERATOR_LARGE"].includes(u.role)
        )
          return reply
            .code(403)
            .send({ error: "Perfil sem acesso ao impacto ambiental." });
        const coop = owner
          ? u.cooperative?.id
          : cat
            ? u.collector?.cooperativeId
            : u.generator?.cooperativeId;
        const gen = owner
          ? input.generatorId
          : cat
            ? undefined
            : u.generator?.id;
        if (
          !coop ||
          (cat && u.collector?.status === "INACTIVE") ||
          (!owner && !cat && !gen) ||
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
            const methodology =
              (cfg?.payload as any)?.methodology || emptyConfig.methodology;
            const participation = cat
              ? {
                  OR: [
                    { collectorId: u.collector!.id },
                    {
                      participants: { some: { collectorId: u.collector!.id } },
                    },
                  ],
                }
              : {};
            const scope = {
              cooperativeId: coop,
              ...(gen ? { generatorId: gen } : {}),
              ...participation,
            };
            const dateWhere = {
              OR: [
                { collectedAt: range },
                { collectedAt: null, receivedAt: range },
                { collectedAt: null, receivedAt: null, completedAt: range },
                {
                  collectedAt: null,
                  receivedAt: null,
                  completedAt: null,
                  createdAt: range,
                },
              ],
            };
            const rows = await tx.collection.findMany({
              where: {
                AND: [
                  scope,
                  dateWhere,
                  { status: { in: [...EXECUTED] as any } },
                ],
              },
              select: {
                id: true,
                generatorId: true,
                binId: true,
                status: true,
                collectedAt: true,
                receivedAt: true,
                completedAt: true,
                createdAt: true,
                quantitiesReviewedAt: true,
                totalWeightKg: true,
                materials: true,
                generator: {
                  select: { id: true, name: true, companyName: true },
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
            const schedules = await tx.schedule.findMany({
              where: {
                cooperativeId: coop,
                createdAt: range,
                ...(gen ? { generatorId: gen } : {}),
                ...(cat
                  ? { collections: { some: participation } }
                  : {
                      requestedBy: {
                        role: {
                          in: [
                            "PF",
                            "GENERATOR_SMALL",
                            "GENERATOR_LARGE",
                            "COLLECTOR",
                          ],
                        },
                      },
                    }),
              },
              select: { id: true, status: true, createdAt: true },
              take: 20001,
            });
            const orders = await tx.extraCollectionOrder.findMany({
              where: {
                cooperativeId: coop,
                createdAt: range,
                ...(cat ? { collectorId: u.collector!.id } : {}),
                ...(gen
                  ? {
                      OR: [
                        { collection: { generatorId: gen } },
                        { payload: { path: ["generatorId"], equals: gen } },
                      ],
                    }
                  : {}),
              },
              select: { id: true, status: true, createdAt: true },
              take: 20001,
            });
            if ([rows, schedules, orders].some((a) => a.length > 20000))
              throw Error(
                "Reduza o período: o recorte ultrapassa 20 mil registros.",
              );
            const groups = new Map<string, typeof rows>();
            for (const c of rows) {
              const key =
                c.generatorId || (c.binId ? "__pevs__" : "__avulsas__");
              const group = groups.get(key);
              if (group) group.push(c);
              else groups.set(key, [c]);
            }
            return {
              start: q.start,
              end: q.end,
              year,
              scope: cat
                ? "COLLECTOR_PARTICIPATION"
                : gen
                  ? "GENERATOR"
                  : "COOPERATIVE",
              basis:
                "Mês da coleta em campo; registros legados usam recebimento, conclusão ou criação quando necessário.",
              description:
                "Potencial estimado com fatores cadastrados. Solicitações pendentes não geram impacto. Pesagens conferidas atualizam o mês da coleta. Participação em equipe não deve ser somada entre catadores: o painel conta cada coleta uma única vez.",
              methodology,
              ...impactSummary(rows, methodology),
              monthly: monthlyImpact(
                rows,
                schedules,
                orders,
                year,
                methodology,
              ),
              requests: schedules.length,
              extraOrders: orders.length,
              generators: [...groups].map(([id, cs]) => ({
                id,
                name:
                  cs[0].generator?.companyName ||
                  cs[0].generator?.name ||
                  (id === "__pevs__"
                    ? "PEVs"
                    : "Pessoa física / coletas avulsas"),
                ...impactSummary(cs, methodology),
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
        if (e instanceof ImpactAccessError)
          return reply.code(e.statusCode).send({ error: e.message });
        if (e instanceof ZodError)
          return reply.code(400).send({ error: e.issues[0]?.message });
        r.log.error({ code: e.code }, "Falha no impacto mensal");
        return reply.code(422).send({
          error: e.message?.startsWith("Reduza")
            ? e.message
            : "Não foi possível consultar o impacto ambiental.",
        });
      }
    },
  );
}
