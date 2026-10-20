import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { AccountStatus, UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../utils/hash";

type Audience = "APP" | "PANEL";
const genericMessage = "Se o e-mail estiver habilitado, enviaremos as instruções. Verifique sua caixa de entrada e spam.";
export const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const roles: Record<string, UserRole> = { pf: "PF", comercial: "GENERATOR_SMALL", grande: "GENERATOR_LARGE", cooperativa: "COOPERATIVE", catador: "COLLECTOR", motorista: "DRIVER" };

export function emailTransport() {
  if (!env.SMTP_HOST || !env.SMTP_FROM || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("Envio de e-mail indisponível. Contate o suporte.");
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
    requireTLS: env.NODE_ENV === "production" && !env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
}

export async function requestAuthEmail(data: { email: string; audience: Audience; profile?: string }, purpose: "LOGIN" | "RESET") {
  // Falha explícita para qualquer endereço quando SMTP não está configurado.
  const transport = emailTransport();
  await prisma.authEmailToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60000) } } });
  const user = await prisma.user.findUnique({ where: { email: data.email.trim().toLowerCase() } });
  if (!user || !user.isActive || user.accountStatus !== AccountStatus.ACTIVE ||
      (data.audience === "PANEL" && !["COOPERATIVE", "MUNICIPAL_MANAGER"].includes(user.role)) ||
      (data.profile && roles[data.profile] !== user.role)) return { message: genericMessage };
  const recent = await prisma.authEmailToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 15 * 60000) } } });
  if (recent >= 3) return { message: genericMessage };
  const token = crypto.randomBytes(32).toString("hex");
  const temporaryPassword = purpose === "RESET" ? crypto.randomBytes(8).toString("hex").toUpperCase() : undefined;
  const record = await prisma.authEmailToken.create({ data: {
    userId: user.id, purpose, audience: data.audience, tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + 15 * 60000),
    temporaryPasswordHash: temporaryPassword ? await hashPassword(temporaryPassword) : null,
  } });
  const base = data.audience === "PANEL" ? env.PANEL_WEB_URL : env.APP_WEB_URL;
  const url = new URL(purpose === "LOGIN" ? "/quick-login" : "/reset-password", base);
  if (purpose === "LOGIN") url.hash = new URLSearchParams({ token }).toString();
  else { url.searchParams.set("email", user.email); url.searchParams.set("token", token); }
  const title = purpose === "LOGIN" ? "Acesso rápido ao KATUÁ" : "Redefinição de senha - KATUÁ";
  const text = `${title}\n\n${temporaryPassword ? `Senha temporária para redefinição: ${temporaryPassword}\n` : ""}${url.toString()}\n\nVálido por 15 minutos, uma única vez. Se não solicitou, ignore este e-mail.`;
  try {
    const sent = await transport.sendMail({ from: env.SMTP_FROM, to: user.email, subject: title, text });
    if (!sent.accepted?.length) throw new Error("SMTP não aceitou o destinatário.");
  } catch {
    await prisma.authEmailToken.deleteMany({ where: { id: record.id } });
    throw new Error("Não foi possível enviar o e-mail agora. Tente novamente mais tarde.");
  } finally { transport.close(); }
  return { message: genericMessage };
}

export async function consumeLoginLink(data: { token: string; audience: Audience }) {
  const invalid = () => new Error("Link inválido, expirado ou já utilizado. Solicite outro acesso.");
  return prisma.$transaction(async tx => {
    const record = await tx.authEmailToken.findUnique({ where: { tokenHash: tokenHash(data.token) }, include: { user: true } });
    if (!record || record.purpose !== "LOGIN" || record.audience !== data.audience || record.consumedAt || record.expiresAt <= new Date()) throw invalid();
    const user = record.user;
    if (!user.isActive || user.accountStatus !== AccountStatus.ACTIVE || (data.audience === "PANEL" && !["COOPERATIVE", "MUNICIPAL_MANAGER"].includes(user.role))) throw invalid();
    const claim = await tx.authEmailToken.updateMany({ where: { id: record.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
    if (claim.count !== 1) throw invalid();
    const hydrated = await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { personProfile: true, generator: true, collector: true, cooperative: true, driver: true } });
    return hydrated;
  });
}
