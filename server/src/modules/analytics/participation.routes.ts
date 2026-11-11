import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { participationQuery } from "./participation.schemas";
import {
  participationContext,
  participationOverview,
  participationPeople,
  participationDetail,
  participationCoverage,
  coverageBuckets,
  generatorsOverview,
} from "./participation.service";
import { ReportError } from "../reports/reports.service";
import { participationAttendance } from "./attendance.service";
import { territoryOverview, collectorsOverview } from "./dimensions.service";
import { recordUsage, usageOverview } from "./usage.service";

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
        return reply.code(500).send({
          error: "Não foi possível consultar o Analytics. Tente novamente.",
        });
      }
    };
  app.post(
    "/analytics/usage/heartbeat",
    auth,
    handle((r) =>
      recordUsage(
        r.user.sub,
        z
          .object({
            activeSeconds: z.number().int().min(0).max(30),
            platform: z.enum(["WEB", "APP"]),
          })
          .strict()
          .parse(r.body),
      ),
    ),
  );
  app.get(
    "/analytics/participation/generators",
    auth,
    handle((r) =>
      generatorsOverview(r.user.sub, participationQuery.parse(r.query)),
    ),
  );
  app.get(
    "/analytics/participation/collectors",
    auth,
    handle((r) =>
      collectorsOverview(r.user.sub, participationQuery.parse(r.query)),
    ),
  );
  app.get(
    "/analytics/participation/territory",
    auth,
    handle((r) =>
      territoryOverview(r.user.sub, participationQuery.parse(r.query)),
    ),
  );
  app.get(
    "/analytics/participation/usage",
    auth,
    handle((r) =>
      usageOverview(
        r.user.sub,
        participationQuery.parse(
          z
            .object({
              start: z.string(),
              end: z.string(),
              page: z.coerce.number().int().min(1).max(100000).default(1),
              pageSize: z.coerce.number().int().min(5).max(50).default(20),
            })
            .strict()
            .parse(r.query),
        ),
      ),
    ),
  );
  app.get(
    "/analytics/participation/coverage/:bucket",
    auth,
    handle((r) =>
      participationCoverage(
        r.user.sub,
        participationQuery.parse(r.query),
        z.enum(coverageBuckets).parse(r.params.bucket),
      ),
    ),
  );
  app.get(
    "/analytics/participation/coverage/:bucket/:id",
    auth,
    handle((r) =>
      participationCoverage(
        r.user.sub,
        participationQuery.parse(r.query),
        z.enum(coverageBuckets).parse(r.params.bucket),
        z.string().min(1).max(100).parse(r.params.id),
      ),
    ),
  );
  app.get(
    "/analytics/participation/attendance",
    auth,
    handle((r) => {
      const period = z
        .object({ start: z.string(), end: z.string() })
        .strict()
        .parse(r.query);
      return participationAttendance(
        r.user.sub,
        participationQuery.parse(period),
      );
    }),
  );
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
