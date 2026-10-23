import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { defaults } from "./settings.schemas";
import { deliver } from "./settings.mail";
const DAY = 86400000;
export async function refreshAlerts(id: string) {
  const row = await prisma.cooperativeSettings.findUnique({
      where: { cooperativeId: id },
    }),
    pref = { ...defaults.preferences, ...(row?.payload as any)?.preferences };
  const now = new Date(),
    scheduledBefore = new Date(
      Date.now() - pref.collectionOverdueHours * 3600000,
    ),
    wasteBefore = new Date(Date.now() - pref.pendingWasteDays * DAY);
  const [coop, collections, entries, docs, maint, pevs, failed] =
    await Promise.all([
      prisma.cooperative.findUniqueOrThrow({ where: { id } }),
      prisma.collection.findMany({
        where: {
          cooperativeId: id,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          OR: [
            { schedule: { scheduledDate: { lt: scheduledBefore } } },
            {
              scheduleId: null,
              route: { scheduledDate: { lt: scheduledBefore } },
            },
          ],
        },
        select: { id: true },
        take: 1001,
      }),
      prisma.collectionWasteEntry.findMany({
        where: {
          cooperativeId: id,
          remainingQuantity: { gt: 0 },
          collection: { status: { not: "CANCELLED" } },
          collectedAt: { lt: wasteBefore },
        },
        select: { id: true, collectionId: true, materialNameSnapshot: true },
        take: 1001,
      }),
      prisma.vehicleDocument.findMany({
        where: {
          cooperativeId: id,
          expiryDate: {
            lte: new Date(Date.now() + pref.documentAdvanceDays * DAY),
          },
        },
        select: {
          id: true,
          vehicleId: true,
          documentType: true,
          expiryDate: true,
          vehicle: { select: { plate: true } },
        },
        take: 1001,
      }),
      prisma.maintenanceLog.findMany({
        where: { cooperativeId: id },
        orderBy: { maintenanceDate: "desc" },
        distinct: ["vehicleId"],
        select: {
          id: true,
          vehicleId: true,
          nextMaintenanceDate: true,
          maintenanceDate: true,
          status: true,
        },
        take: 1001,
      }),
      prisma.bin.findMany({
        where: {
          cooperativeId: id,
          needsPickup: true,
          status: { not: "INACTIVE" },
        },
        select: { id: true, name: true, binId: true },
        take: 1001,
      }),
      prisma.mailDelivery.findMany({
        where: {
          cooperativeId: id,
          status: { in: ["FAILED", "UNKNOWN", "PARTIAL"] },
        },
        select: { id: true, status: true },
        take: 1001,
      }),
    ]);
  const list: any[] = [];
  const add = (
    key: string,
    category: string,
    title: string,
    message: string,
    link: string,
    priority = "WARNING",
  ) => list.push({ key, category, title, message, link, priority });
  for (const c of collections)
    add(
      "collection:" + c.id,
      "COLLECTION",
      "Coleta com programação vencida",
      `Sem execução após ${pref.collectionOverdueHours} hora(s) da programação.`,
      "/edit-waste/" + c.id,
    );
  for (const e of entries)
    add(
      "entry:" + e.id,
      "WASTE",
      "Saldo aguardando destinação",
      `${e.materialNameSnapshot}: saldo pendente há mais de ${pref.pendingWasteDays} dia(s).`,
      "/collected-waste/" + e.id,
    );
  for (const d of docs)
    add(
      "document:" + d.id,
      "DOCUMENT",
      d.expiryDate! < now
        ? "Documento vencido"
        : "Documento próximo do vencimento",
      `${d.vehicle?.plate || "Veículo não vinculado"} · ${d.documentType} · ${d.expiryDate?.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })}`,
      "/document-list",
      d.expiryDate! < now ? "CRITICAL" : "WARNING",
    );
  for (const m of maint)
    if (
      (m.nextMaintenanceDate && m.nextMaintenanceDate < now) ||
      (["OVERDUE", "PENDING", "SCHEDULED"].includes(m.status) &&
        m.maintenanceDate < now)
    )
      add(
        "maintenance:" + m.id,
        "MAINTENANCE",
        "Manutenção com prazo vencido",
        "Confira o agendamento ou a próxima manutenção cadastrada.",
        "/maintenance-list",
      );
  for (const b of pevs)
    add(
      "pev:" + b.id,
      "PEV",
      "PEV precisa de retirada",
      b.name || b.binId,
      "/bin-list",
    );
  if (failed.length)
    add(
      "smtp:failure",
      "SMTP",
      "Há e-mails que precisam de atenção",
      `${failed.length} envio(s) com falha, aceite parcial ou confirmação desconhecida.`,
      "/smtp-config",
      "CRITICAL",
    );
  const missing = [
    ["nome", coop.name],
    ["CNPJ", coop.registrationNumber],
    ["e-mail institucional", coop.email],
    ["telefone", coop.phone],
    ["município", coop.city],
    ["endereço", coop.street || coop.address],
  ]
    .filter(([, v]) => !v)
    .map(([label]) => label);
  if (missing.length)
    add(
      "profile:missing",
      "PROFILE",
      "Complete o cadastro da cooperativa",
      "Campos pendentes: " + missing.join(", "),
      "/settings",
      "INFO",
    );
  const truncated = [collections, entries, docs, maint, pevs, failed].some(
    (x) => x.length >= 1001,
  );
  await prisma.$transaction(
    async (tx) => {
      const existing = await tx.systemAlert.findMany({
        where: { cooperativeId: id },
      });
      for (const item of list) {
        const prior = existing.find((a) => a.key === item.key);
        if (!prior)
          await tx.systemAlert.createMany({
            data: [{ cooperativeId: id, ...item }],
            skipDuplicates: true,
          });
        else
          await tx.systemAlert.update({
            where: { id: prior.id },
            data: {
              ...item,
              status: "OPEN",
              resolvedAt: null,
              ...(prior.status === "RESOLVED"
                ? { cycle: { increment: 1 }, readAt: null, snoozedUntil: null }
                : {}),
            },
          });
      }
      if (!truncated)
        await tx.systemAlert.updateMany({
          where: {
            cooperativeId: id,
            status: "OPEN",
            key: { notIn: list.map((a) => a.key) },
          },
          data: { status: "RESOLVED", resolvedAt: now },
        });
    },
    { timeout: 30000 },
  );
  return { truncated };
}
export async function dispatchNotifications(id: string) {
  const row = await prisma.cooperativeSettings.findUnique({
      where: { cooperativeId: id },
      include: { cooperative: { select: { name: true } } },
    }),
    pref = { ...defaults.preferences, ...(row?.payload as any)?.preferences };
  if (
    !pref.emailEnabled ||
    !(row?.smtp as any)?.enabled ||
    !pref.recipients.length
  )
    return;
  const now = new Date();
  if (!pref.categories.length) return;
  const active: any[] =
    pref.frequency === "DAILY"
      ? await prisma.systemAlert.findMany({
          where: {
            cooperativeId: id,
            status: "OPEN",
            category: { in: pref.categories },
            OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 501,
        })
      : await prisma.$queryRaw<any[]>(Prisma.sql`
    SELECT a.* FROM "SystemAlert" a
    WHERE a."cooperativeId"=${id} AND a."status"='OPEN'
      AND a."category" IN (${Prisma.join(pref.categories)})
      AND (a."snoozedUntil" IS NULL OR a."snoozedUntil"<=${now})
      AND NOT EXISTS (SELECT 1 FROM "MailDelivery" m WHERE m."cooperativeId"=${id}
        AND m."dedupeKey"='alert:' || a."id" || ':' || a."cycle"::text)
    ORDER BY a."createdAt" ASC,a."id" ASC LIMIT 20
  `);
  if (!active.length) return;
  const civil = new Date(Date.now() - 3 * 3600000).toISOString(),
    hour = Number(civil.slice(11, 13));
  if (pref.frequency === "DAILY" && hour < pref.digestHour) return;
  const batches =
    pref.frequency === "DAILY"
      ? [active.slice(0, 500)]
      : active.map((a) => [a]);
  for (const batch of batches) {
    const dedupeKey =
      pref.frequency === "DAILY"
        ? "digest:" + civil.slice(0, 10)
        : "alert:" + batch[0].id + ":" + batch[0].cycle;
    await prisma.mailDelivery.createMany({
      data: [
        {
          cooperativeId: id,
          dedupeKey,
          recipients: [...new Set<string>(pref.recipients)],
          subject:
            pref.frequency === "DAILY"
              ? "KATUÁ — resumo diário de pendências"
              : "KATUÁ — " + batch[0].title,
          text:
            (row?.cooperative.name || "KATUÁ") +
            "\n\n" +
            batch
              .map(
                (a) =>
                  `${a.title}\n${a.message}\nAbra o painel KATUÁ para conferir a pendência.`,
              )
              .join("\n\n") +
            (pref.frequency === "DAILY" && active.length > 500
              ? "\n\nResumo limitado a 500 pendências; consulte as demais no painel."
              : ""),
        },
      ],
      skipDuplicates: true,
    });
  }
}
export async function notificationTick() {
  const configs = await prisma.cooperativeSettings.findMany({
    where: {
      cooperative: { user: { isActive: true, accountStatus: "ACTIVE" } },
    },
    select: { cooperativeId: true },
  });
  for (const c of configs) {
    try {
      await refreshAlerts(c.cooperativeId);
      await dispatchNotifications(c.cooperativeId);
    } catch {
      console.warn(
        "[settings] Falha na atualização de avisos; nova tentativa no próximo ciclo.",
      );
    }
  }
  await prisma.mailDelivery.updateMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: new Date(Date.now() - 10 * 60000) },
    },
    data: {
      status: "UNKNOWN",
      error: "Envio interrompido; confirme o recebimento antes de reenviar.",
    },
  });
  const pending = await prisma.mailDelivery.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  for (const p of pending) await deliver(p.id);
}
