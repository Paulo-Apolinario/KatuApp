import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { kinds, querySchema } from "./reports.schemas";
import {
  reportScope,
  reportContext,
  runReport,
  reportDetail,
  saveConfig,
  ReportError,
} from "./reports.service";
export async function reportsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };
  const handle =
    (fn: (r: any, c: any) => Promise<unknown>) => async (r: any, p: any) => {
      try {
        const coop = await reportScope(r.user.sub);
        p.header("Cache-Control", "private, no-store");
        return { data: await fn(r, coop) };
      } catch (e: any) {
        if (e instanceof ZodError)
          return p
            .code(400)
            .send({ error: e.issues.map((i) => i.message).join(" ") });
        if (e instanceof ReportError)
          return p.code(e.statusCode).send({ error: e.message });
        r.log.error({ code: e.code }, "Falha nos relatórios");
        return p.code(500).send({
          error:
            "Não foi possível gerar o relatório. Confira o serviço e as migrações da API.",
        });
      }
    };
  app.get(
    "/reports/context",
    auth,
    handle((_r, c) => reportContext(c)),
  );
  app.get(
    "/reports/collections/:id",
    auth,
    handle((r, c) =>
      reportDetail(
        c,
        z.object({ id: z.string().min(1).max(100) }).parse(r.params).id,
      ),
    ),
  );
  app.put(
    "/reports/config",
    auth,
    handle((r, c) => saveConfig(c, r.user.sub, r.body)),
  );
  app.get(
    "/reports/:kind",
    auth,
    handle((r, c) =>
      runReport(
        c,
        querySchema.parse(r.query),
        z.object({ kind: z.enum(kinds) }).parse(r.params).kind,
      ),
    ),
  );
}
