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
import { AnalyticsAccess, AnalyticsAccessError } from "./access.service";
import { reportScope, ReportError } from "../reports/reports.service";
import { participationAttendance } from "./attendance.service";
import { territoryOverview, collectorsOverview } from "./dimensions.service";
import { recordUsage, usageOverview } from "./usage.service";
import {
  requestDrilldown,
  qualityDrilldown,
  comparisonOverview,
  executiveOverview,
  requestOutcomes,
  qualityIssues,
} from "./insights.service";

export async function participationAnalyticsRoutes(app: FastifyInstance) {
  const access = new AnalyticsAccess();
  const authenticated = { preHandler: [app.authenticate] };
  const auth = {
    preHandler: [
      app.authenticate,
      async (r: any, reply: any) => {
        reply.header("Cache-Control", "private, no-store");
        try {
          access.require(
            r.user.sub,
            r.headers.authorization || "",
            r.headers["x-analytics-access"],
          );
        } catch (error) {
          if (error instanceof AnalyticsAccessError)
            return reply
              .code(error.statusCode)
              .send({ error: error.message, code: error.code });
          throw error;
        }
      },
    ],
  };
  const handle =
    (fn: (r: any) => Promise<unknown>) => async (r: any, reply: any) => {
      reply.header("Cache-Control", "private, no-store");
      try {
        return { data: await fn(r) };
      } catch (error: unknown) {
        if (error instanceof AnalyticsAccessError)
          return reply
            .code(error.statusCode)
            .send({ error: error.message, code: error.code });
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
    "/analytics/access/unlock",
    authenticated,
    handle(async (r) => {
      await reportScope(r.user.sub);
      const { password } = z
        .object({ password: z.string().min(1).max(128) })
        .strict()
        .parse(r.body);
      return access.unlock(r.user.sub, r.headers.authorization || "", password);
    }),
  );
  app.post(
    "/analytics/access/lock",
    authenticated,
    handle(async (r) =>
      access.lock(
        r.user.sub,
        r.headers.authorization || "",
        r.headers["x-analytics-access"],
      ),
    ),
  );
  app.get(
    "/analytics/access/status",
    auth,
    handle(async (r) => {
      await reportScope(r.user.sub);
      return access.require(
        r.user.sub,
        r.headers.authorization || "",
        r.headers["x-analytics-access"],
      );
    }),
  );
  app.get(
    "/analytics/participation/requests/:outcome",
    auth,
    handle((r) => {
      const q = z
        .object({
          start: z.string(),
          end: z.string(),
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(5).max(50).default(20),
          search: z.string().max(120).default(""),
        })
        .strict()
        .parse(r.query);
      return requestDrilldown(
        r.user.sub,
        participationQuery.parse(q),
        z.enum(requestOutcomes).parse(r.params.outcome),
      );
    }),
  );
  app.get(
    "/analytics/participation/quality/:issue",
    auth,
    handle((r) =>
      qualityDrilldown(
        r.user.sub,
        participationQuery.parse(r.query),
        z.enum(qualityIssues).parse(r.params.issue),
      ),
    ),
  );
  app.get(
    "/analytics/participation/comparison",
    auth,
    handle((r) =>
      comparisonOverview(r.user.sub, participationQuery.parse(r.query)),
    ),
  );
  app.get(
    "/analytics/participation/executive",
    auth,
    handle((r) =>
      executiveOverview(r.user.sub, participationQuery.parse(r.query)),
    ),
  );
  app.post(
    "/analytics/usage/heartbeat",
    authenticated,
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
    handle((r) => {
      const { materialKey = "", ...query } = z
        .object({ materialKey: z.string().max(600).optional() })
        .passthrough()
        .parse(r.query);
      return territoryOverview(
        r.user.sub,
        participationQuery.parse(query),
        new Date(),
        materialKey,
      );
    }),
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
