import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../utils/hash";
import { phoneDigits, lookupAccount } from "../auth/account-lookup";
import {
  emailTransport,
  sendAccountInstructions,
} from "../auth/auth-email.service";

export async function registrationAccessRoutes(app: FastifyInstance) {
  app.post(
    "/registrations/:kind/:id/access-link",
    { preHandler: [app.authenticate] },
    async (r, reply) => {
      reply.header("Cache-Control", "private, no-store");
      if (r.user.role !== "COOPERATIVE")
        return reply.forbidden(
          "Apenas a cooperativa pode liberar o acesso de seus colaboradores.",
        );
      if (
        !z
          .object({})
          .strict()
          .safeParse(r.body ?? {}).success
      )
        return reply.badRequest(
          "Informe o destinatário no cadastro antes de solicitar o acesso.",
        );
      const parsed = z
        .object({
          kind: z.enum(["generators", "collectors"]),
          id: z.string().min(1).max(100),
        })
        .safeParse(r.params);
      if (!parsed.success) return reply.badRequest("Cadastro inválido.");
      const { kind, id } = parsed.data;
      const coop = await prisma.cooperative.findUnique({
        where: { userId: r.user.sub },
        select: { id: true },
      });
      if (!coop) return reply.forbidden();
      try {
        const config = emailTransport();
        config.close();
        const passwordHash = await hashPassword(
          randomBytes(32).toString("hex"),
        );
        const userId = await prisma.$transaction(async (tx) => {
          // Serialize enrollment with registration edits, never across cooperatives.
          if (kind === "generators")
            await tx.$queryRaw`SELECT id FROM "Generator" WHERE id=${id} AND "cooperativeId"=${coop.id} FOR UPDATE`;
          else
            await tx.$queryRaw`SELECT id FROM "Collector" WHERE id=${id} AND "cooperativeId"=${coop.id} FOR UPDATE`;
          const record =
            kind === "generators"
              ? await tx.generator.findFirst({
                  where: { id, cooperativeId: coop.id },
                })
              : await tx.collector.findFirst({
                  where: { id, cooperativeId: coop.id },
                });
          if (!record)
            throw Object.assign(Error("Cadastro não encontrado."), {
              statusCode: 404,
            });
          if (!record.email && !record.recoveryEmail)
            throw Object.assign(
              Error(
                "Informe um e-mail de recuperação antes de enviar o acesso.",
              ),
              { statusCode: 400 },
            );
          if (record.userId) return record.userId;
          if (!record.email && !phoneDigits(record.phone))
            throw Object.assign(
              Error(
                "Informe um celular com DDD para entrar sem e-mail pessoal.",
              ),
              { statusCode: 400 },
            );
          // A phone-only account must not reuse an already registered account number.
          // The public login also refuses any legacy ambiguity instead of picking a user.
          const user = await tx.user.create({
            data: {
              email: record.email,
              phone: record.phone,
              displayName: record.name,
              passwordHash,
              credentialsReady: false,
              role:
                kind === "collectors"
                  ? "COLLECTOR"
                  : "type" in record && record.type === "LARGE"
                    ? "GENERATOR_LARGE"
                    : "GENERATOR_SMALL",
            },
          });
          if (kind === "generators")
            await tx.generator.update({
              where: { id },
              data: { userId: user.id },
            });
          else
            await tx.collector.update({
              where: { id },
              data: { userId: user.id },
            });
          await tx.registrationAccessEvent.create({
            data: {
              cooperativeId: coop.id,
              actorUserId: r.user.sub,
              recordKind: kind,
              recordId: id,
              action: "ACCESS_PREPARED",
            },
          });
          return user.id;
        });
        const candidate = await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          include: { generator: true, collector: true },
        });
        if (!candidate.email) {
          const resolved = await lookupAccount(
            candidate.generator?.phone ||
              candidate.collector?.phone ||
              candidate.phone ||
              "",
            "PHONE",
          );
          if (resolved?.id !== candidate.id)
            return reply.badRequest(
              "Este celular é compartilhado ou não identifica uma única conta. Informe um e-mail pessoal ou corrija o celular antes de liberar o acesso.",
            );
        }
        await sendAccountInstructions(userId, "APP", "RESET");
        await prisma.registrationAccessEvent.create({
          data: {
            cooperativeId: coop.id,
            actorUserId: r.user.sub,
            recordKind: kind,
            recordId: id,
            action: "ACCESS_INSTRUCTIONS_REQUESTED",
          },
        });
        return {
          success: true,
          message:
            "Solicitação de acesso recebida. As instruções seguem para o e-mail de recuperação cadastrado, quando habilitado. Confira a caixa de entrada e spam.",
        };
      } catch (error: any) {
        r.log.warn(
          { code: error.code },
          "Não foi possível preparar o acesso assistido",
        );
        return reply
          .code(error.code === "P2002" ? 409 : error.statusCode || 400)
          .send({
            success: false,
            error:
              error.code === "P2002"
                ? "Este e-mail já está vinculado a outra conta."
                : error.message || "Não foi possível enviar o acesso agora.",
          });
      }
    },
  );
}
