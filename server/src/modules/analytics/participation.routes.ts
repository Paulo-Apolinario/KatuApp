import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { participationQuery } from "./participation.schemas";
import {
  participationContext,
  participationOverview,
  participationPeople,
  participationDetail,
} from "./participation.service";
import { ReportError } from "../reports/reports.service";

export async function participationAnalyticsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };
  const handle =
    (fn: (r: any) => Promise<unknown>) => async (r: any, reply: any) => {
      reply.header("Cache-Control", "private, no-store");
      try {
        return { data: await fn(r) };
      } catch (error: unknown) {
        if (error instanceof ZodError)
          return reply
            .code(400)
            .send({ error: error.issues.map((i) => i.message).join(" ") });
        if (error instanceof ReportError)
          return reply.code(error.statusCode).send({ error: error.message });
        r.log.error(
          { code: (error as { code?: string }).code },
          "Falha no Analytics de participação",
        );
        return reply
          .code(500)
          .send({
            error: "Não foi possível consultar o Analytics. Tente novamente.",
          });
      }
    };
  app.get(
    "/analytics/participation/context",
    auth,
    handle((r) => participationContext(r.user.sub)),
  );
  app.get(
    "/analytics/participation/overview",
    auth,
    handle((r) =>
      participationOverview(r.user.sub, participationQuery.parse(r.query)),
    ),
  );
  app.get(
    "/analytics/participation/participants",
    auth,
    handle((r) =>
      participationPeople(r.user.sub, participationQuery.parse(r.query)),
    ),
  );
  app.get(
    "/analytics/participation/participants/:kind/:id",
    auth,
    handle((r) => {
      const { kind, id } = z
        .object({
          kind: z.enum(["PF", "GENERATOR"]),
          id: z.string().min(1).max(100),
        })
        .parse(r.params);
      return participationDetail(
        r.user.sub,
        participationQuery.parse(r.query),
        kind,
        id,
      );
    }),
  );
}
