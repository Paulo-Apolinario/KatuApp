import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ReportError } from "../reports/reports.service";
import { participationQuery, bounds } from "./participation.schemas";

export const monitoringQuery = z.object({
  start: z.string(), end: z.string(),
  search: z.string().trim().max(120).default(""),
  city: z.string().trim().max(120).default(""),
  status: z.enum(["", "READY", "PENDING", "BLOCKED"]).default(""),
  activity: z.enum(["", "MEASURED", "NO_SIGNAL"]).default(""),
  inactiveDays: z.enum(["", "7", "30", "60"]).default(""),
  cooperativeId: z.string().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((q, ctx) => {
  const result = participationQuery.safeParse({ start: q.start, end: q.end });
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
});
type Query = z.infer<typeof monitoringQuery>;
export async function monitoringScope(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true, accountStatus: true, credentialsReady: true, cooperative: { select: { id: true } } } });
  if (!user?.isActive || !user.credentialsReady || user.accountStatus !== "ACTIVE") throw new ReportError("Conta indisponível.", 403);
  if (user.role === "ADMIN") return { all: true, cooperativeId: null };
  if (user.role === "COOPERATIVE" && user.cooperative) return { all: false, cooperativeId: user.cooperative.id };
  throw new ReportError("Acompanhamento restrito à cooperativa e à administração do KATUÁ.", 403);
}
function relations(scope: Awaited<ReturnType<typeof monitoringScope>>, q: Query, now: Date) {
  const state = Prisma.sql`CASE WHEN NOT u."isActive" OR u."accountStatus"<>'ACTIVE' THEN 'BLOCKED' WHEN NOT u."credentialsReady" THEN 'PENDING' ELSE 'READY' END`;
  const cutoff = q.inactiveDays ? new Date(now.getTime() - Number(q.inactiveDays) * 86400000) : null;
  return Prisma.sql`WITH orgs AS (
    SELECT c.id,c.name,c."registrationNumber" AS document,c.city,c.state,c."createdAt" AS registered_at,c."userId" AS owner_id,
      u."accessEnabledAt" AS enabled_at,${state} AS access_status
    FROM "Cooperative" c JOIN "User" u ON u.id=c."userId"
    WHERE ${scope.all ? Prisma.sql`TRUE` : Prisma.sql`c.id=${scope.cooperativeId}`}
      ${q.cooperativeId ? Prisma.sql`AND c.id=${q.cooperativeId}` : Prisma.empty}
      ${q.search ? Prisma.sql`AND strpos(lower(concat_ws(' ',c.name,c."registrationNumber",c.city)),lower(${q.search}))>0` : Prisma.empty}
      ${q.city ? Prisma.sql`AND strpos(lower(coalesce(c.city,'')),lower(${q.city}))>0` : Prisma.empty}
      ${q.status ? Prisma.sql`AND ${state}=${q.status}` : Prisma.empty}
  ), members AS (
    SELECT o.id AS cooperative_id,u.id,u."displayName" AS name,u.role::text AS role,u."createdAt" AS registered_at,
      u."accessEnabledAt" AS enabled_at,u."firstLoginAt" AS first_login,u."lastLoginAt" AS last_login,${state} AS access_status
    FROM orgs o JOIN "User" u ON
      (u.id=o.owner_id AND u.role='COOPERATIVE') OR
      (u.role='COLLECTOR' AND EXISTS(SELECT 1 FROM "Collector" x WHERE x."userId"=u.id AND x."cooperativeId"=o.id)) OR
      (u.role='DRIVER' AND EXISTS(SELECT 1 FROM "Driver" x WHERE x."userId"=u.id AND x."cooperativeId"=o.id)) OR
      (u.role IN ('GENERATOR_SMALL','GENERATOR_LARGE') AND EXISTS(SELECT 1 FROM "Generator" x WHERE x."userId"=u.id AND x."cooperativeId"=o.id))
  ), activity AS (
    SELECT d."userId" AS user_id,d."cooperativeId" AS cooperative_id,
      max(d."lastSeenAt") AS last_activity,
      min(d.day) AS first_observed_day,
      coalesce(sum(d.seconds) FILTER(WHERE d.day>=${q.start} AND d.day<=${q.end}),0)::float8 AS seconds,
      count(*) FILTER(WHERE d.seconds>0 AND d.day>=${q.start} AND d.day<=${q.end})::int AS days,
      bool_or(d."webUsed") FILTER(WHERE d.day>=${q.start} AND d.day<=${q.end}) AS web_used,
      bool_or(d."appUsed") FILTER(WHERE d.day>=${q.start} AND d.day<=${q.end}) AS app_used
    FROM "AnalyticsUsageDaily" d JOIN members m ON m.id=d."userId" AND m.cooperative_id=d."cooperativeId"
    WHERE d."lastSeenAt"<=${now} GROUP BY d."userId",d."cooperativeId"
  ), accounts AS (
    SELECT m.*,a.last_activity,a.first_observed_day,coalesce(a.seconds,0)::float8 AS seconds,coalesce(a.days,0)::int AS days,
      coalesce(a.web_used,false) AS web_used,coalesce(a.app_used,false) AS app_used
    FROM members m LEFT JOIN activity a ON a.user_id=m.id AND a.cooperative_id=m.cooperative_id
  ), base AS (
    SELECT o.*,count(a.id)::int AS accounts,count(a.id) FILTER(WHERE a.days>0)::int AS measured_accounts,
      coalesce(sum(a.seconds),0)::float8 AS seconds,max(a.last_login) AS last_login,max(a.last_activity) AS last_activity,
      min(a.first_observed_day) AS first_observed_day,bool_or(a.web_used) AS web_used,bool_or(a.app_used) AS app_used,
      (SELECT count(DISTINCT d.day)::int FROM "AnalyticsUsageDaily" d JOIN members m ON m.id=d."userId" AND m.cooperative_id=d."cooperativeId"
        WHERE d."cooperativeId"=o.id AND d.day>=${q.start} AND d.day<=${q.end} AND d.seconds>0 AND d."lastSeenAt"<=${now}) AS days
    FROM orgs o LEFT JOIN accounts a ON a.cooperative_id=o.id GROUP BY o.id,o.name,o.document,o.city,o.state,o.registered_at,o.owner_id,o.enabled_at,o.access_status
  ), rows AS (
    SELECT * FROM base WHERE TRUE
      ${q.activity === "MEASURED" ? Prisma.sql`AND measured_accounts>0` : q.activity === "NO_SIGNAL" ? Prisma.sql`AND measured_accounts=0` : Prisma.empty}
      ${cutoff ? Prisma.sql`AND last_activity IS NOT NULL AND last_activity<${cutoff}` : Prisma.empty}
  )`;
}
export async function monitoringReport(userId: string, q: Query, exporting = false, now = new Date()) {
  const scope = await monitoringScope(userId);
  if (q.cooperativeId && !scope.all && q.cooperativeId !== scope.cooperativeId) throw new ReportError("Cooperativa não encontrada.", 404);
  const cte = relations(scope, q, now);
  const period = bounds(participationQuery.parse({ start: q.start, end: q.end }), now);
  return prisma.$transaction(async db => {
    if (q.cooperativeId && !await db.cooperative.findFirst({ where: { id: q.cooperativeId, ...(!scope.all ? { id: scope.cooperativeId! } : {}) }, select: { id: true } })) throw new ReportError("Cooperativa não encontrada.", 404);
    const [summary] = await db.$queryRaw<any[]>(Prisma.sql`${cte} SELECT count(*)::int AS cooperatives,
      count(*) FILTER(WHERE access_status='READY')::int AS enabled,
      count(*) FILTER(WHERE measured_accounts>0)::int AS measured,
      coalesce(sum(seconds),0)::float8 AS seconds,coalesce(sum(accounts),0)::int AS accounts,
      count(*) FILTER(WHERE last_activity IS NULL)::int AS unknown_activity FROM rows`);
    if (exporting && summary.cooperatives > 10000) throw new ReportError("A exportação excede 10.000 cooperativas. Reduza os filtros.", 400);
    const limit = exporting ? 10000 : q.pageSize;
    const items = await db.$queryRaw<any[]>(Prisma.sql`${cte} SELECT r.*,
      (SELECT count(*)::int FROM "Collection" c WHERE c."cooperativeId"=r.id AND coalesce(c."intakeKind",'')<>'MIXED_BAG' AND c."createdAt">=${period.start} AND c."createdAt"<${period.end}) AS collections,
      (SELECT count(*)::int FROM "Collection" c WHERE c."cooperativeId"=r.id AND c.status IN ('RECEIVED','SORTING','COMPLETED') AND c."receivedAt">=${period.start} AND c."receivedAt"<${period.end}) AS receipts,
      (SELECT count(*)::int FROM "MixedBagEvent" e WHERE e."cooperativeId"=r.id AND e.kind='SORT' AND e."reversedAt" IS NULL AND e."createdAt">=${period.start} AND e."createdAt"<${period.end}) AS triages,
      ((SELECT count(*) FROM "InternalDocument" d WHERE d."cooperativeId"=r.id AND d.kind='STOCK_DISPATCH' AND d."createdAt">=${period.start} AND d."createdAt"<${period.end})+
       (SELECT count(*) FROM "WasteStockMovement" m WHERE m."cooperativeId"=r.id AND m.kind IN ('SALE','DONATION','DIRECT_DESTINATION','DISPOSAL') AND m."operationId" NOT LIKE 'bulk:%' AND m."createdAt">=${period.start} AND m."createdAt"<${period.end}))::int AS dispatches
      FROM rows r ORDER BY r.last_activity DESC NULLS LAST,r.name,r.id LIMIT ${limit} OFFSET ${exporting || q.cooperativeId ? 0 : (q.page - 1) * q.pageSize}`);
    let accounts: unknown[] | undefined;
    let accountPagination: { total: number; page: number; totalPages: number } | undefined;
    if (q.cooperativeId) {
      const [count] = await db.$queryRaw<{ total: number }[]>(Prisma.sql`${cte} SELECT count(*)::int AS total FROM accounts a JOIN rows r ON r.id=a.cooperative_id`);
      if (exporting && count.total > 10000) throw new ReportError("A exportação excede 10.000 contas. Reduza o escopo.", 400);
      accounts = await db.$queryRaw(Prisma.sql`${cte} SELECT a.* FROM accounts a JOIN rows r ON r.id=a.cooperative_id ORDER BY a.last_activity DESC NULLS LAST,a.name,a.id LIMIT ${limit} OFFSET ${exporting ? 0 : (q.page - 1) * q.pageSize}`);
      accountPagination = { total: count.total, page: q.page, totalPages: Math.max(1, Math.ceil(count.total / q.pageSize)) };
    }
    return { scope: scope.all ? "ALL" : "OWN", summary, items, accounts, accountPagination,
      pagination: { page: q.page, total: summary.cooperatives, totalPages: Math.max(1, Math.ceil(summary.cooperatives / q.pageSize)) },
      meta: { generatedAt: now, start: q.start, end: q.end, timezone: "America/Fortaleza", loginObservedSince: "2026-11-23" },
      method: "Tempo ativo aproximado, com tela em primeiro plano e interação recente. Versões antigas e uso offline podem não produzir sinal. Ausência de medição não comprova ausência de uso. Na linha da cooperativa, login e atividade representam o registro mais recente entre suas contas vinculadas. Último login e última atividade são históricos; tempo, dias, sistemas e operações respeitam o período. Totais de tempo somam as contas e podem incluir pessoas trabalhando simultaneamente.",
      limitations: "Datas históricas de habilitação e login não foram reconstruídas. Validade contratual não está configurada. Coletas são registros criados; recebimentos são confirmações atuais; triagens são eventos de bags não estornados; saídas contam cada operação consolidada uma vez. As operações não são somáveis entre si como um único total de atendimentos.",
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
}
