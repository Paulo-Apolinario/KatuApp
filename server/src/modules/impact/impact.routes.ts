import { isDeepStrictEqual } from "node:util";
import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../lib/prisma";
import { wasteCooperativeScope } from "../waste-workspace/waste-workspace.routes";
import { ImpactAccessError } from "./impact-summary.service";
import { analysisQuery, analyzeImpact } from "./impact-analysis.service";
import { materialProfileSchema } from "./material-profile";
export async function impactRoutes(app: FastifyInstance) {
  app.get(
    "/environmental-impact",
    { preHandler: [app.authenticate] },
    async (r, reply) => {
      try {
        const data = await analyzeImpact(
          r.user.sub,
          analysisQuery.parse(r.query),
        );
        reply.header("Cache-Control", "private, no-store");
        return {
          data: {
            ...data,
            origins: data.generators,
            reference: {
              label: "Metodologia por material",
              version: data.methodology.version || "Pendente",
            },
          },
        };
      } catch (e: any) {
        r.log.error({ code: e.code }, "Falha na consulta ambiental");
        return reply
          .code(
            e instanceof ZodError
              ? 400
              : e instanceof ImpactAccessError
                ? e.statusCode
                : 500,
          )
          .send({
            error:
              e instanceof ZodError
                ? e.issues[0]?.message
                : e instanceof ImpactAccessError
                  ? e.message
                  : "Não foi possível consultar o impacto ambiental.",
          });
      }
    },
  );
  app.put(
    "/environmental-impact/materials/:id/identification",
    { preHandler: [app.authenticate] },
    async (r, reply) => {
      try {
        const cooperativeId = await wasteCooperativeScope(r.user.sub);
        const { id } = z
          .object({ id: z.string().min(1).max(100) })
          .parse(r.params);
        const input = z
          .object({
            operationId: z.string().uuid(),
            expectedUpdatedAt: z.string().datetime(),
            profile: materialProfileSchema,
          })
          .strict()
          .parse(r.body);
        const result = await prisma.$transaction(async (tx) => {
          const m = await tx.collectionMaterial.findFirst({
            where: { id, collection: { cooperativeId } },
          });
          if (!m)
            throw new ImpactAccessError(
              "Material não encontrado nesta cooperativa.",
              404,
            );
          const snapshot = (m.identificationSnapshot as any) || {};
          const history = snapshot.history || [];
          const previous = history.find(
            (h: any) => h.operationId === input.operationId,
          );
          if (previous) {
            if (
              !isDeepStrictEqual(previous.profile, input.profile) ||
              previous.actorUserId !== r.user.sub
            )
              throw new ImpactAccessError(
                "Identificador de operação já utilizado com outros dados.",
                409,
              );
            return { replayed: true };
          }
          const event = {
            operationId: input.operationId,
            actorUserId: r.user.sub,
            at: new Date().toISOString(),
            profile: input.profile,
          };
          const updated = await tx.collectionMaterial.updateMany({
            where: { id, updatedAt: new Date(input.expectedUpdatedAt) },
            data: {
              identificationSnapshot: {
                ...snapshot,
                confirmed: event,
                history: [...history, event],
              },
            },
          });
          if (!updated.count)
            throw new ImpactAccessError(
              "O material foi alterado. Atualize os dados antes de conferir.",
              409,
            );
          return { confirmed: true };
        });
        reply.header("Cache-Control", "private, no-store");
        return result;
      } catch (e: any) {
        return reply
          .code(e instanceof ZodError ? 400 : e.statusCode || 500)
          .send({
            error:
              e instanceof ZodError
                ? e.issues[0]?.message
                : e.statusCode
                  ? e.message
                  : "Não foi possível registrar a identificação.",
          });
      }
    },
  );
}
