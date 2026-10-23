import { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../lib/prisma";
import {
  scope,
  context,
  saveCompany,
  savePrefs,
  saveSmtp,
  smtpTest,
  passwordRequest,
  passwordConfirm,
} from "./settings.service";
import { SettingsError } from "./settings.mail";
import { refreshAlerts, notificationTick } from "./settings.alerts";
export async function settingsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };
  const handle =
    (fn: (r: any, u: any) => Promise<any>) => async (r: any, p: any) => {
      try {
        p.header("Cache-Control", "private, no-store");
        const u = await scope(r.user.sub);
        return { data: await fn(r, u) };
      } catch (e: any) {
        if (e instanceof ZodError)
          return p
            .code(400)
            .send({ error: e.issues.map((i) => i.message).join(" ") });
        if (e instanceof SettingsError)
          return p.code(e.statusCode).send({ error: e.message });
        if (e.code === "P2002")
          return p
            .code(409)
            .send({ error: "CNPJ ou e-mail já utilizado. Revise o cadastro." });
        r.log.error({ code: e.code }, "Falha nas configurações");
        return p.code(500).send({
          error:
            "Não foi possível concluir a operação. Confira a API e suas migrações.",
        });
      }
    };
  app.get(
    "/settings/branding",
    auth,
    handle(async (_r, u) => {
      const row = await prisma.cooperativeSettings.findUnique({
        where: { cooperativeId: u.cooperative.id },
      });
      return {
        name: u.cooperative.name,
        logo: (row?.payload as any)?.company?.logo || "",
      };
    }),
  );
  app.get(
    "/settings/context",
    auth,
    handle((_r, u) => context(u)),
  );
  app.put(
    "/settings/company",
    auth,
    handle((r, u) => saveCompany(u, r.body)),
  );
  app.put(
    "/settings/preferences",
    auth,
    handle((r, u) => savePrefs(u, r.body)),
  );
  app.put(
    "/settings/smtp",
    auth,
    handle((r, u) => saveSmtp(u, r.body)),
  );
  app.post(
    "/settings/smtp/verify",
    auth,
    handle((_r, u) => smtpTest(u, false)),
  );
  app.post(
    "/settings/smtp/test",
    auth,
    handle((_r, u) => smtpTest(u, true)),
  );
  app.post(
    "/settings/password/request",
    auth,
    handle((_r, u) => passwordRequest(u)),
  );
  app.post(
    "/settings/password/confirm",
    auth,
    handle((r, u) =>
      passwordConfirm(
        u,
        z
          .object({
            challengeId: z.string().uuid(),
            code: z.string().regex(/^\d{6}$/),
            newPassword: z
              .string()
              .min(12, "Use ao menos 12 caracteres.")
              .max(128),
          })
          .strict()
          .parse(r.body),
      ),
    ),
  );
  app.get(
    "/settings/history",
    auth,
    handle(async (r, u) => {
      const { page } = z
        .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
        .strict()
        .parse(r.query);
      const where = { cooperativeId: u.cooperative.id };
      const [rows, total] = await prisma.$transaction([
        prisma.settingEvent.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (page - 1) * 20,
          take: 20,
        }),
        prisma.settingEvent.count({ where }),
      ]);
      return { rows, total, page };
    }),
  );
  app.get(
    "/settings/mail-history",
    auth,
    handle(async (_r, u) =>
      prisma.mailDelivery.findMany({
        where: { cooperativeId: u.cooperative.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          subject: true,
          recipients: true,
          status: true,
          error: true,
          attempts: true,
          createdAt: true,
          sentAt: true,
        },
      }),
    ),
  );
  app.post(
    "/settings/mail-history/:id/retry",
    auth,
    handle(async (r, u) => {
      const row = await prisma.mailDelivery.findFirst({
        where: {
          id: r.params.id,
          cooperativeId: u.cooperative.id,
          status: "FAILED",
          attempts: { lt: 5 },
        },
      });
      if (!row)
        throw new SettingsError(
          "Envio não disponível para nova tentativa.",
          404,
        );
      const changed = await prisma.mailDelivery.updateMany({
        where: { id: row.id, status: "FAILED", attempts: row.attempts },
        data: { status: "PENDING", error: null },
      });
      if (!changed.count)
        throw new SettingsError("O envio já está sendo processado.", 409);
      await prisma.settingEvent.create({
        data: {
          cooperativeId: u.cooperative.id,
          actorId: u.id,
          actorName: u.displayName,
          section: "MAIL_RETRY",
          fields: [],
        },
      });
      return {
        message:
          "Nova tentativa agendada. O processamento ocorre em até um minuto.",
      };
    }),
  );
  app.get(
    "/settings/alerts",
    auth,
    handle(async (_r, u) => {
      const info = await refreshAlerts(u.cooperative.id);
      const rows = await prisma.systemAlert.findMany({
        where: { cooperativeId: u.cooperative.id },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 1000,
      });
      const total = await prisma.systemAlert.count({
        where: { cooperativeId: u.cooperative.id },
      });
      return {
        ...info,
        rows,
        total,
        truncated: info.truncated || total > rows.length,
      };
    }),
  );
  app.patch(
    "/settings/alerts/:id",
    auth,
    handle(async (r, u) => {
      const v = z
        .object({
          action: z.enum(["READ", "SNOOZE", "ASSIGN"]),
          assignee: z.string().trim().max(100).optional(),
          hours: z.number().int().min(1).max(168).optional(),
        })
        .strict()
        .parse(r.body);
      if (v.action === "SNOOZE" && !v.hours)
        throw new SettingsError("Informe as horas para adiar.");
      const result = await prisma.systemAlert.updateMany({
        where: { id: r.params.id, cooperativeId: u.cooperative.id },
        data:
          v.action === "READ"
            ? { readAt: new Date() }
            : v.action === "SNOOZE"
              ? { snoozedUntil: new Date(Date.now() + v.hours! * 3600000) }
              : { assignee: v.assignee || null },
      });
      if (!result.count) throw new SettingsError("Alerta não encontrado.", 404);
      await prisma.settingEvent.create({
        data: {
          cooperativeId: u.cooperative.id,
          actorId: u.id,
          actorName: u.displayName,
          section: "ALERT_" + v.action,
          fields: [],
        },
      });
      return {
        message:
          "Alerta atualizado. A resolução acompanha a condição de origem.",
      };
    }),
  );
  let timer: ReturnType<typeof setInterval>,
    running = false;
  let inFlight: Promise<void> | null = null;
  app.addHook("onReady", async () => {
    if (process.env.NODE_ENV === "test") return;
    timer = setInterval(() => {
      if (running) return;
      running = true;
      inFlight = notificationTick()
        .catch((e: any) =>
          app.log.error({ code: e.code }, "Falha no processamento de avisos"),
        )
        .finally(() => {
          running = false;
        });
    }, 60000);
    timer.unref();
  });
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await inFlight;
  });
}
