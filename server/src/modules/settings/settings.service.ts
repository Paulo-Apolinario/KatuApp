import crypto from "node:crypto";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../utils/hash";
import { emailTransport } from "../auth/auth-email.service";
import { env } from "../../config/env";
import {
  companySchema,
  prefsSchema,
  smtpSchema,
  defaults,
} from "./settings.schemas";
import {
  SettingsError,
  encrypt,
  encryptionReady,
  smtpTransport,
  deliver,
} from "./settings.mail";
export async function scope(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { cooperative: true },
  });
  if (
    !user?.cooperative ||
    user.role !== "COOPERATIVE" ||
    !user.isActive ||
    user.accountStatus !== "ACTIVE"
  )
    throw new SettingsError("Acesso restrito à cooperativa autenticada.", 403);
  return user;
}
const codeHash = (id: string, code: string) =>
  crypto
    .createHmac("sha256", env.JWT_SECRET)
    .update(id + ":" + code)
    .digest("hex");
export const coopFields = [
  "name",
  "registrationNumber",
  "email",
  "phone",
  "zipCode",
  "street",
  "number",
  "neighborhood",
  "city",
  "state",
  "address",
  "latitude",
  "longitude",
];
async function stored(id: string) {
  return prisma.cooperativeSettings.findUnique({
    where: { cooperativeId: id },
  });
}
export async function context(u: any) {
  const row = await stored(u.cooperative.id),
    payload = row?.payload as any;
  const c = u.cooperative;
  return {
    version: row?.version || 0,
    company: {
      ...Object.fromEntries(
        coopFields.map((k) => [
          k,
          c[k] ?? (["latitude", "longitude"].includes(k) ? null : ""),
        ]),
      ),
      ...defaults.company,
      ...payload?.company,
    },
    preferences: { ...defaults.preferences, ...payload?.preferences },
    smtp: {
      enabled: false,
      host: "",
      port: 587,
      security: "STARTTLS",
      username: "",
      fromName: c.name,
      fromAddress: "",
      replyTo: "",
      ...(row?.smtp as any),
      hasPassword: !!row?.smtpPassword,
    },
    account: { id: u.id, name: u.displayName, email: u.email },
    encryptionReady: encryptionReady(),
    centralEmailReady: !!(
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASS &&
      env.SMTP_FROM
    ),
    updatedAt: row?.updatedAt || null,
  };
}
async function mutate(
  u: any,
  version: number,
  section: string,
  fields: string[],
  fn: (tx: any, row: any) => Promise<any>,
) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.cooperativeSettings.findUnique({
      where: { cooperativeId: u.cooperative.id },
    });
    if ((row?.version || 0) !== version)
      throw new SettingsError(
        "As configurações mudaram. Recarregue antes de salvar.",
        409,
      );
    if (!row) {
      const created = await tx.cooperativeSettings.createMany({
        data: [{ cooperativeId: u.cooperative.id, payload: defaults }],
        skipDuplicates: true,
      });
      if (!created.count)
        throw new SettingsError(
          "As configurações mudaram. Recarregue antes de salvar.",
          409,
        );
    } else {
      const updated = await tx.cooperativeSettings.updateMany({
        where: { cooperativeId: u.cooperative.id, version },
        data: { version: { increment: 1 } },
      });
      if (!updated.count)
        throw new SettingsError(
          "As configurações mudaram. Recarregue antes de salvar.",
          409,
        );
    }
    await fn(tx, row);
    await tx.settingEvent.create({
      data: {
        cooperativeId: u.cooperative.id,
        actorId: u.id,
        actorName: u.displayName,
        section,
        fields,
      },
    });
    return { message: "Alterações salvas." };
  });
}
export async function saveCompany(u: any, input: unknown) {
  const v = companySchema.parse(input);
  const old = await context(u);
  const changed = Object.keys(v).filter(
    (k) =>
      k !== "version" &&
      JSON.stringify((old.company as any)[k]) !== JSON.stringify((v as any)[k]),
  );
  return mutate(u, v.version, "COMPANY", changed, async (tx, row) => {
    const data = Object.fromEntries(
      coopFields.map((k) => [k, (v as any)[k] === "" ? null : (v as any)[k]]),
    );
    if (v.registrationNumber)
      data.registrationNumber = v.registrationNumber
        .replace(/[.\/\-\s]/g, "")
        .toUpperCase();
    await tx.cooperative.update({ where: { id: u.cooperative.id }, data });
    await tx.cooperativeSettings.update({
      where: { cooperativeId: u.cooperative.id },
      data: {
        payload: {
          ...defaults,
          ...row?.payload,
          company: {
            legalName: v.legalName,
            responsibleName: v.responsibleName,
            responsiblePosition: v.responsiblePosition,
            website: v.website,
            logo: v.logo,
          },
        },
      },
    });
  });
}
export async function savePrefs(u: any, input: unknown) {
  const { version, ...preferences } = prefsSchema.parse(input);
  if (preferences.emailEnabled) {
    const row = await stored(u.cooperative.id);
    if (!(row?.smtp as any)?.enabled || !row?.smtpPassword)
      throw new SettingsError("Ative o SMTP antes dos avisos por e-mail.");
  }
  const old = await context(u);
  return mutate(
    u,
    version,
    "PREFERENCES",
    Object.keys(preferences).filter(
      (k) =>
        JSON.stringify((old.preferences as any)[k]) !==
        JSON.stringify((preferences as any)[k]),
    ),
    async (tx, row) => {
      await tx.cooperativeSettings.update({
        where: { cooperativeId: u.cooperative.id },
        data: { payload: { ...defaults, ...row?.payload, preferences } },
      });
      await tx.mailDelivery.updateMany({
        where: {
          cooperativeId: u.cooperative.id,
          status: "PENDING",
          OR: [
            { dedupeKey: { startsWith: "alert:" } },
            { dedupeKey: { startsWith: "digest:" } },
          ],
        },
        data: {
          status: "CANCELLED",
          error: "Preferências de notificação atualizadas antes do envio.",
        },
      });
    },
  );
}
export async function saveSmtp(u: any, input: unknown) {
  const { version, password, ...smtp } = smtpSchema.parse(input);
  const old = await stored(u.cooperative.id);
  if (!old?.smtpPassword && !password)
    throw new SettingsError("Informe a credencial SMTP.");
  const encrypted = password
    ? encrypt(password, u.cooperative.id)
    : old!.smtpPassword;
  const changed = Object.keys(smtp).filter(
    (k) =>
      JSON.stringify((old?.smtp as any)?.[k]) !==
      JSON.stringify((smtp as any)[k]),
  );
  if (password) changed.push("password");
  return mutate(u, version, "SMTP", changed, async (tx) => {
    await tx.cooperativeSettings.update({
      where: { cooperativeId: u.cooperative.id },
      data: { smtp, smtpPassword: encrypted },
    });
  });
}
export async function smtpTest(u: any, send: boolean) {
  const id = u.cooperative.id;
  const recent = await prisma.settingEvent.count({
    where: {
      cooperativeId: id,
      section: { in: ["SMTP_VERIFY", "SMTP_TEST"] },
      createdAt: { gte: new Date(Date.now() - 15 * 60000) },
    },
  });
  if (recent >= 3)
    throw new SettingsError(
      "Aguarde 15 minutos para realizar novos testes.",
      429,
    );
  await prisma.settingEvent.create({
    data: {
      cooperativeId: id,
      actorId: u.id,
      actorName: u.displayName,
      section: send ? "SMTP_TEST" : "SMTP_VERIFY",
      fields: [],
    },
  });
  if (send) {
    const row = await prisma.mailDelivery.create({
      data: {
        cooperativeId: id,
        dedupeKey: crypto.randomUUID(),
        recipients: [u.email],
        subject: "KATUÁ — teste de e-mail da cooperativa",
        text: "Este é um teste solicitado nas configurações da sua cooperativa. O provedor aceitar o envio não garante a entrega na caixa de entrada.",
      },
    });
    await deliver(row.id);
    const result = await prisma.mailDelivery.findUniqueOrThrow({
      where: { id: row.id },
    });
    if (!["SENT", "PARTIAL"].includes(result.status))
      throw new SettingsError(result.error || "Falha no envio.");
    return {
      message:
        "Mensagem aceita pelo provedor. Confira sua caixa de entrada e spam.",
    };
  }
  let t: any;
  try {
    const s = await smtpTransport(id);
    t = s.transport;
    await t.verify();
    return {
      message:
        "Conexão e autenticação verificadas. Envie um teste para conferir o remetente.",
    };
  } catch (e) {
    throw e instanceof SettingsError
      ? e
      : new SettingsError(
          "Não foi possível validar a conexão. Confira servidor, porta e credencial.",
        );
  } finally {
    t?.close();
  }
}
export async function passwordRequest(u: any) {
  const id = crypto.randomUUID(),
    code = crypto.randomInt(100000, 1000000).toString();
  const row = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${u.id} FOR UPDATE`;
    const count = await tx.authEmailToken.count({
      where: {
        userId: u.id,
        purpose: "SETTINGS_PASSWORD",
        createdAt: { gt: new Date(Date.now() - 15 * 60000) },
      },
    });
    if (count >= 3)
      throw new SettingsError(
        "Aguarde 15 minutos para solicitar outro código.",
        429,
      );
    return tx.authEmailToken.create({
      data: {
        id,
        userId: u.id,
        purpose: "SETTINGS_PASSWORD",
        audience: "PANEL",
        tokenHash: codeHash(id, code),
        expiresAt: new Date(Date.now() + 10 * 60000),
      },
    });
  });
  let t: any;
  try {
    t = emailTransport();
    const sent = await t.sendMail({
      from: env.SMTP_FROM,
      to: u.email,
      subject: "KATUÁ — confirme a troca da sua senha",
      text: `Seu código para definir uma nova senha é: ${code}\nVálido por 10 minutos e uma única vez. Não compartilhe este código. Se não solicitou, ignore esta mensagem.`,
    });
    if (!sent.accepted?.length) throw Error("Recusado");
    await prisma.authEmailToken.updateMany({
      where: {
        userId: u.id,
        purpose: "SETTINGS_PASSWORD",
        id: { not: row.id },
        createdAt: { lte: row.createdAt },
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });
    return {
      challengeId: id,
      message:
        "Código enviado para o e-mail cadastrado da sua conta. Validade: 10 minutos.",
    };
  } catch {
    await prisma.authEmailToken.deleteMany({ where: { id } });
    throw new SettingsError(
      "Não foi possível enviar o código. Solicite ao administrador que confira o SMTP geral do KATUÁ.",
      503,
    );
  } finally {
    t?.close();
  }
}
export async function passwordConfirm(
  u: any,
  v: { challengeId: string; code: string; newPassword: string },
) {
  const row = await prisma.authEmailToken.findFirst({
    where: {
      id: v.challengeId,
      userId: u.id,
      purpose: "SETTINGS_PASSWORD",
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: 5 },
    },
  });
  if (!row)
    throw new SettingsError(
      "Código inválido, expirado ou com limite de tentativas atingido.",
    );
  const attempt = await prisma.authEmailToken.updateMany({
    where: { id: row.id, attempts: { lt: 5 }, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (
    !attempt.count ||
    !crypto.timingSafeEqual(
      Buffer.from(row.tokenHash),
      Buffer.from(codeHash(row.id, v.code)),
    )
  )
    throw new SettingsError(
      "Código inválido. Solicite outro após cinco tentativas.",
    );
  const passwordHash = await hashPassword(v.newPassword);
  await prisma.$transaction(async (tx) => {
    const claim = await tx.authEmailToken.updateMany({
      where: {
        id: row.id,
        userId: u.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (!claim.count)
      throw new SettingsError("Código já utilizado ou expirado.");
    await tx.user.update({
      where: { id: u.id },
      data: {
        passwordHash,
        authVersion: { increment: 1 },
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });
    await tx.authEmailToken.updateMany({
      where: { userId: u.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.settingEvent.create({
      data: {
        cooperativeId: u.cooperative.id,
        actorId: u.id,
        actorName: u.displayName,
        section: "PASSWORD",
        fields: ["password"],
      },
    });
  });
  return {
    message:
      "Senha alterada. Entre novamente com sua nova senha ou acesso rápido.",
  };
}
