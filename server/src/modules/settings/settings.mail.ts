import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import nodemailer from "nodemailer";
import { prisma } from "../../lib/prisma";
export class SettingsError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}
export function encryptionReady() {
  try {
    return (
      Buffer.from(process.env.SETTINGS_ENCRYPTION_KEY || "", "base64")
        .length === 32
    );
  } catch {
    return false;
  }
}
function key() {
  if (!encryptionReady())
    throw new SettingsError(
      "O administrador precisa configurar SETTINGS_ENCRYPTION_KEY no .env da API.",
      503,
    );
  return Buffer.from(process.env.SETTINGS_ENCRYPTION_KEY!, "base64");
}
export function encrypt(value: string, coopId: string) {
  const iv = crypto.randomBytes(12),
    c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(coopId));
  const data = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [
    iv.toString("base64"),
    c.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(".");
}
function decrypt(value: string, coopId: string) {
  try {
    const [iv, tag, data] = value.split(".");
    const c = crypto.createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "base64"),
    );
    c.setAAD(Buffer.from(coopId));
    c.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      c.update(Buffer.from(data, "base64")),
      c.final(),
    ]).toString("utf8");
  } catch {
    throw new SettingsError(
      "Não foi possível abrir a credencial SMTP. Confira a chave do servidor ou atualize a senha.",
      503,
    );
  }
}
// Apenas IPv4 públicos; endereço resolvido é fixado na conexão para impedir DNS rebinding.
export function publicIPv4(ip: string) {
  const a = ip.split(".").map(Number);
  return (
    a.length === 4 &&
    a.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) &&
    ![0, 10, 127].includes(a[0]) &&
    a[0] < 224 &&
    !(a[0] === 169 && a[1] === 254) &&
    !(a[0] === 172 && a[1] >= 16 && a[1] <= 31) &&
    !(a[0] === 192 && (a[1] === 168 || a[1] === 0 || a[1] === 2)) &&
    !(a[0] === 100 && a[1] >= 64 && a[1] <= 127) &&
    !(a[0] === 198 && [18, 19, 51].includes(a[1])) &&
    !(a[0] === 203 && a[1] === 0 && a[2] === 113)
  );
}
export async function smtpTransport(id: string) {
  const row = await prisma.cooperativeSettings.findUnique({
    where: { cooperativeId: id },
  });
  const s = row?.smtp as any;
  if (!s?.enabled || !row?.smtpPassword)
    throw new SettingsError("Configure e ative o SMTP da cooperativa.");
  const addresses = await lookup(s.host, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicIPv4(a.address)))
    throw new SettingsError(
      "O servidor SMTP precisa resolver para endereço público IPv4.",
    );
  const t = nodemailer.createTransport({
    host: addresses[0].address,
    port: s.port,
    secure: s.security === "TLS",
    requireTLS: s.security === "STARTTLS",
    tls: { servername: s.host, rejectUnauthorized: true },
    auth: { user: s.username, pass: decrypt(row.smtpPassword, id) },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    transport: t,
    from: { name: s.fromName, address: s.fromAddress },
    replyTo: s.replyTo || undefined,
  };
}
export async function deliver(id: string) {
  const row = await prisma.mailDelivery.findUnique({
    where: { id },
    include: {
      cooperative: {
        select: {
          user: { select: { isActive: true, accountStatus: true } },
          systemSettings: { select: { payload: true } },
        },
      },
    },
  });
  if (!row || !["PENDING", "FAILED"].includes(row.status)) return;
  const notification =
    row.dedupeKey.startsWith("alert:") || row.dedupeKey.startsWith("digest:");
  if (
    !row.cooperative.user.isActive ||
    row.cooperative.user.accountStatus !== "ACTIVE" ||
    (notification &&
      !(row.cooperative.systemSettings?.payload as any)?.preferences
        ?.emailEnabled)
  ) {
    await prisma.mailDelivery.updateMany({
      where: { id, status: row.status },
      data: {
        status: "CANCELLED",
        error: "Avisos desativados ou conta inativa.",
      },
    });
    return;
  }
  const claim = await prisma.mailDelivery.updateMany({
    where: { id, status: row.status, attempts: { lt: 5 } },
    data: { status: "SENDING", attempts: { increment: 1 }, error: null },
  });
  if (!claim.count) return;
  let t: any;
  try {
    const smtp = await smtpTransport(row.cooperativeId);
    t = smtp.transport;
    const sent = await t.sendMail({
      from: smtp.from,
      replyTo: smtp.replyTo,
      to: row.recipients,
      subject: row.subject,
      text: row.text,
    });
    const accepted = sent.accepted?.length || 0;
    if (!accepted)
      throw new SettingsError("O provedor não aceitou o destinatário.");
    await prisma.mailDelivery.update({
      where: { id },
      data: {
        status: sent.rejected?.length ? "PARTIAL" : "SENT",
        sentAt: new Date(),
        error: sent.rejected?.length
          ? "Alguns destinatários foram recusados. Confira os endereços."
          : null,
      },
    });
  } catch (e: any) {
    const status =
      ["ETIMEDOUT", "ESOCKET", "ECONNECTION"].includes(e.code) &&
      !["CONN", "AUTH", "AUTH LOGIN", "AUTH PLAIN"].includes(e.command)
        ? "UNKNOWN"
        : "FAILED";
    await prisma.mailDelivery.update({
      where: { id },
      data: {
        status,
        error:
          e instanceof SettingsError
            ? e.message
            : e.code === "EAUTH"
              ? "Autenticação SMTP recusada. Confira usuário e credencial."
              : "Falha no envio. Confira conexão, remetente e configuração do provedor.",
      },
    });
  } finally {
    t?.close();
  }
}
