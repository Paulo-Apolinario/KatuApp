import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  teamService,
  teamScope,
  TeamError,
  teamSchema,
  allocationSchema,
} from "./team.service";
import { CollectionService } from "../collections/collection.service";
const collections = new CollectionService();
export async function collectorTeamRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  const safe =
    (fn: (r: any, coop: string) => Promise<any>) =>
    async (r: any, reply: any) => {
      try {
        reply.header("Cache-Control", "private, no-store");
        return await fn(r, await teamScope(r.user.sub));
      } catch (e: any) {
        if (e instanceof ZodError)
          return reply.code(400).send({ error: e.issues[0]?.message });
        if (e instanceof TeamError)
          return reply.code(e.statusCode).send({ error: e.message });
        r.log.error({ code: e.code }, "Falha na operação de equipe");
        return reply.code(e.code === "P2034" ? 409 : 500).send({
          error:
            "Não foi possível concluir. Atualize os dados e tente novamente.",
        });
      }
    };
  app.get(
    "/collector-teams",
    safe(async (_r, c) => ({ teams: await teamService.list(c) })),
  );
  app.post(
    "/collector-teams",
    safe(async (r, c) => ({
      team: await teamService.save(c, teamSchema.parse(r.body)),
    })),
  );
  app.patch(
    "/collector-teams/:id",
    safe(async (r, c) => ({
      team: await teamService.save(c, teamSchema.parse(r.body), r.params.id),
    })),
  );
  app.post(
    "/collections/:id/team",
    safe(async (r, c) => {
      const b = z
        .object({
          teamId: z.string().min(1).nullable(),
          expectedVersion: z.number().int().min(0),
        })
        .strict()
        .parse(r.body);
      await teamService.assign(c, r.params.id, b.teamId, b.expectedVersion);
      return {
        collection: await collections.findById(
          r.user.sub,
          r.user.role,
          r.params.id,
        ),
      };
    }),
  );
  app.post(
    "/collections/:id/allocate-materials",
    safe(async (r, c) => {
      await teamService.allocate(
        c,
        r.user.sub,
        r.params.id,
        allocationSchema.parse(r.body),
      );
      return {
        collection: await collections.findById(
          r.user.sub,
          r.user.role,
          r.params.id,
        ),
      };
    }),
  );
}
