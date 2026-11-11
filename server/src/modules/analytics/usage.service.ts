import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ReportError, reportScope } from "../reports/reports.service";
import { civilDay, type ParticipationQuery } from "./participation.schemas";

export async function recordUsage(
  userId: string,
  input: { activeSeconds: number; platform: "WEB" | "APP" },
  now = new Date(),
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      accountStatus: true,
      cooperative: { select: { id: true } },
      collector: { select: { cooperativeId: true } },
      driver: { select: { cooperativeId: true } },
      generator: { select: { cooperativeId: true } },
    },
  });
  if (!user || !user.isActive || user.accountStatus !== "ACTIVE")
    throw new ReportError("Conta indisponível.", 403);
  const cooperativeId =
    user.role === "COOPERATIVE"
      ? user.cooperative?.id
      : user.role === "COLLECTOR"
        ? user.collector?.cooperativeId
        : user.role === "DRIVER"
          ? user.driver?.cooperativeId
          : ["GENERATOR_SMALL", "GENERATOR_LARGE"].includes(user.role)
            ? user.generator?.cooperativeId
            : null;
  // PF has no persistent cooperative membership. Do not attribute global PF
  // screen time to an organization merely because that person requested a pickup.
  if (!cooperativeId)
    return { recorded: false, reason: "NO_ORGANIZATION_MEMBERSHIP" };
  const day = civilDay(now),
    elapsed = Math.floor(
      (now.getTime() - Date.parse(day + "T00:00:00-03:00")) / 1000,
    );
  const seconds = Math.min(input.activeSeconds, elapsed, 30);
  if (seconds <= 0) return { recorded: false, reason: "NO_ACTIVE_INTERVAL" };
  const slot = new Date(Math.floor(now.getTime() / 30000) * 30000);
  const id = createHash("sha256")
    .update(userId + ":" + day)
    .digest("hex");
  // Atomic max per server-controlled 30-second slot: retries and concurrent tabs
  // cannot multiply the same user's estimate. Store daily totals, not raw events.
  await prisma.$executeRaw(Prisma.sql`INSERT INTO "AnalyticsUsageDaily" (id,"userId","cooperativeId",day,seconds,"lastSlot","lastSlotSeconds","lastSeenAt","webUsed","appUsed","roleSnapshot")
    VALUES (${id},${userId},${cooperativeId},${day},${seconds},${slot},${seconds},${now},${input.platform === "WEB"},${input.platform === "APP"},${user.role})
    ON CONFLICT ("userId",day) DO UPDATE SET
      seconds=LEAST(86400,"AnalyticsUsageDaily".seconds+CASE WHEN EXCLUDED."lastSlot">"AnalyticsUsageDaily"."lastSlot" THEN EXCLUDED."lastSlotSeconds"
        WHEN EXCLUDED."lastSlot"="AnalyticsUsageDaily"."lastSlot" THEN GREATEST(0,EXCLUDED."lastSlotSeconds"-"AnalyticsUsageDaily"."lastSlotSeconds") ELSE 0 END),
      "lastSlotSeconds"=CASE WHEN EXCLUDED."lastSlot">"AnalyticsUsageDaily"."lastSlot" THEN EXCLUDED."lastSlotSeconds" ELSE GREATEST("AnalyticsUsageDaily"."lastSlotSeconds",EXCLUDED."lastSlotSeconds") END,
      "lastSlot"=GREATEST("AnalyticsUsageDaily"."lastSlot",EXCLUDED."lastSlot"),"lastSeenAt"=GREATEST("AnalyticsUsageDaily"."lastSeenAt",EXCLUDED."lastSeenAt"),
      "webUsed"="AnalyticsUsageDaily"."webUsed" OR EXCLUDED."webUsed","appUsed"="AnalyticsUsageDaily"."appUsed" OR EXCLUDED."appUsed"
    WHERE "AnalyticsUsageDaily"."cooperativeId"=EXCLUDED."cooperativeId"`);
  return { recorded: true };
}

export async function usageOverview(
  userId: string,
  q: ParticipationQuery,
  now = new Date(),
) {
  const coop = await reportScope(userId);
  const cte = Prisma.sql`WITH members AS (
    SELECT u.id,u."displayName" AS name,u.role::text AS role FROM "User" u WHERE
      (u.role='COOPERATIVE' AND EXISTS(SELECT 1 FROM "Cooperative" c WHERE c.id=${coop.id} AND c."userId"=u.id)) OR
      (u.role='COLLECTOR' AND EXISTS(SELECT 1 FROM "Collector" c WHERE c."cooperativeId"=${coop.id} AND c."userId"=u.id)) OR
      (u.role='DRIVER' AND EXISTS(SELECT 1 FROM "Driver" c WHERE c."cooperativeId"=${coop.id} AND c."userId"=u.id)) OR
      (u.role IN ('GENERATOR_SMALL','GENERATOR_LARGE') AND EXISTS(SELECT 1 FROM "Generator" c WHERE c."cooperativeId"=${coop.id} AND c."userId"=u.id))
  ), rows AS (
    SELECT m.id,m.name,m.role,coalesce(sum(d.seconds),0)::float8 AS seconds,count(d.id)::float8 AS days,
      max(d."lastSeenAt") AS last_seen,bool_or(d."webUsed") AS web_used,bool_or(d."appUsed") AS app_used
    FROM members m LEFT JOIN "AnalyticsUsageDaily" d ON d."userId"=m.id AND d."cooperativeId"=${coop.id} AND d.day>=${q.start} AND d.day<=${q.end}
    GROUP BY m.id,m.name,m.role
  )`;
  return prisma.$transaction(
    async (db) => {
      const [summary] = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT count(*)::float8 AS accounts,count(*) FILTER(WHERE days>0)::float8 AS measured_accounts,coalesce(sum(seconds),0)::float8 AS seconds FROM rows`,
      );
      const items = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT * FROM rows ORDER BY seconds DESC,name,id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      );
      return {
        summary,
        items,
        page: q.page,
        pageSize: q.pageSize,
        meta: { generatedAt: now, start: q.start, end: q.end },
        scope:
          "Contas com vínculo atual à cooperativa. Somente o período se aplica. PF sem vínculo organizacional persistente não tem tempo atribuído à cooperativa.",
        method:
          "Tempo ativo aproximado, em intervalos de até 30 segundos, com tela em primeiro plano e interação nos últimos 60 segundos. Não é jornada de trabalho nem duração de coleta. Dados começam com a atualização dos clientes; versões antigas e uso offline não são medidos.",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}
