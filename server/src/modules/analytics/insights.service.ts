import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { reportScope } from "../reports/reports.service";
import { relations } from "./participation.service";
import { attendanceRelations, classifiedRequests } from "./attendance.service";
import { usageRelations } from "./usage.service";
import { bounds, type ParticipationQuery } from "./participation.schemas";

type Db = Prisma.TransactionClient;
export const requestOutcomes = [
  "ALL",
  "RECEIVED",
  "PENDING",
  "CANCELLED",
  "CLOSED_WITHOUT_RECEIPT",
  "CHECK",
] as const;
export const qualityIssues = [
  "missing_received_date",
  "future_received_date",
  "conflicting_relations",
  "unweighed",
  "legacy_weight",
  "missing_neighborhood",
  "unattributed_receipts",
  "unattributed_requests",
  "request_status_mismatch",
] as const;
export type QualityIssue = (typeof qualityIssues)[number];
const accepted = Prisma.sql`('RECEIVED','SORTING','COMPLETED')`;
const literal = (value: string) => "%" + value.replace(/[\\%_]/g, "\\$&") + "%";

export async function requestDrilldown(
  userId: string,
  q: ParticipationQuery,
  outcome: (typeof requestOutcomes)[number],
  now = new Date(),
) {
  const coop = await reportScope(userId);
  const cte = Prisma.sql`${classifiedRequests(attendanceRelations(coop.id, q, now))}, listed AS (
    SELECT r.*,c.id AS collection_id,CASE WHEN r.invalid_link THEN 'Origem a conferir'
      ELSE coalesce(nullif(g."companyName",''),g.name,CASE WHEN u.role='PF' THEN u."displayName" END,'Origem não identificada') END AS origin
    FROM classified r JOIN "Schedule" s ON s.id=r.id AND s."cooperativeId"=${coop.id}
    LEFT JOIN "Generator" g ON g.id=s."generatorId" AND g."cooperativeId"=${coop.id}
    LEFT JOIN "User" u ON u.id=s."requestedByUserId"
    LEFT JOIN "Collection" c ON c."scheduleId"=s.id AND c."cooperativeId"=${coop.id}
    WHERE ${outcome === "ALL" ? Prisma.sql`true` : Prisma.sql`r.outcome=${outcome}`}
  )`;
  const where = q.search
    ? Prisma.sql`WHERE origin ILIKE ${literal(q.search)} OR id ILIKE ${literal(q.search)}`
    : Prisma.empty;
  return prisma.$transaction(
    async (db) => {
      const [count] = await db.$queryRaw<{ total: number }[]>(
        Prisma.sql`${cte} SELECT count(*)::float8 AS total FROM listed ${where}`,
      );
      const items = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT id,origin,status,outcome,created_at,received_at,collection_id FROM listed ${where} ORDER BY created_at DESC,id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      );
      return {
        items,
        total: count.total,
        page: q.page,
        pageSize: q.pageSize,
        scope:
          "Pedidos criados no período, em toda a cooperativa, classificados pela situação atual. Vínculos com O.C. já estão incluídos. Busca afeta apenas esta lista.",
        meta: { generatedAt: now, start: q.start, end: q.end },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}

export async function qualityDrilldown(
  userId: string,
  q: ParticipationQuery,
  issue: QualityIssue,
  now = new Date(),
) {
  const coop = await reportScope(userId),
    p = bounds(q, now);
  const conditions: Record<QualityIssue, Prisma.Sql> = {
    missing_received_date: Prisma.sql`status IN ${accepted} AND received_at IS NULL`,
    future_received_date: Prisma.sql`status IN ${accepted} AND received_at>${now}`,
    conflicting_relations: Prisma.sql`bucket='CONFLICT'`,
    unweighed: Prisma.sql`NOT has_quantity AND coalesce(legacy_kg,0)<=0`,
    legacy_weight: Prisma.sql`NOT has_quantity AND legacy_kg>0`,
    missing_neighborhood: Prisma.sql`neighborhood_key='__unknown__'`,
    unattributed_receipts: Prisma.sql`bucket='UNATTRIBUTED'`,
    unattributed_requests: Prisma.sql`party_key IS NULL`,
    request_status_mismatch: Prisma.sql`has_received AND status IN ('REQUESTED','SCHEDULED','IN_PROGRESS')`,
  };
  const historical = [
    "missing_received_date",
    "future_received_date",
    "conflicting_relations",
  ].includes(issue);
  const request = ["unattributed_requests", "request_status_mismatch"].includes(
    issue,
  );
  const source = request
    ? Prisma.sql`raw_requests`
    : historical
      ? Prisma.sql`operations`
      : Prisma.sql`geo_period`;
  const cte = Prisma.sql`${relations(coop.id, q, now)}, listed AS (
    SELECT id,created_at,status,${request ? Prisma.sql`NULL::timestamp` : Prisma.sql`received_at`} AS received_at,
      CASE WHEN party_key IS NOT NULL THEN display_name ELSE 'Origem não identificada ou a conferir' END AS origin
    FROM ${source} WHERE ${conditions[issue]} ${request ? Prisma.sql`AND created_at>=${p.start} AND created_at<${p.end}` : Prisma.empty}
  )`;
  const where = q.search
    ? Prisma.sql`WHERE origin ILIKE ${literal(q.search)} OR id ILIKE ${literal(q.search)}`
    : Prisma.empty;
  return prisma.$transaction(
    async (db) => {
      const [count] = await db.$queryRaw<{ total: number }[]>(
        Prisma.sql`${cte} SELECT count(*)::float8 AS total FROM listed ${where}`,
      );
      const items = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT * FROM listed ${where} ORDER BY created_at DESC,id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      );
      return {
        items,
        total: count.total,
        page: q.page,
        pageSize: q.pageSize,
        kind: request ? "SCHEDULE" : "COLLECTION",
        issue,
        meta: { generatedAt: now, start: q.start, end: q.end },
        scope: historical
          ? "Todo o histórico atual da cooperativa; período e filtros geográficos não restringem este diagnóstico."
          : request
            ? "Solicitações criadas no período, em toda a cooperativa."
            : "Recebimentos no período e na seleção geográfica, em todos os perfis.",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}

function shiftDay(day: string, days: number) {
  return new Date(Date.parse(day + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function comparablePeriods(q: ParticipationQuery, now: Date) {
  const days =
    Math.round((Date.parse(q.end) - Date.parse(q.start)) / 86400000) + 1;
  const current = bounds(q, now),
    previous = {
      ...q,
      start: shiftDay(q.start, -days),
      end: shiftDay(q.end, -days),
    };
  return {
    days,
    current,
    previous,
    previousCutoff: new Date(current.end.getTime() - days * 86400000),
  };
}
async function metrics(
  db: Db,
  coop: string,
  q: ParticipationQuery,
  now: Date,
  cutoff?: Date,
) {
  const period = bounds(q, now);
  if (cutoff && cutoff < period.end) period.end = cutoff;
  const [row] = await db.$queryRaw<
    Record<string, number>[]
  >(Prisma.sql`${relations(coop, q, now, false, cutoff)} SELECT
    (SELECT count(*)::float8 FROM active_origins) AS active,
    (SELECT count(*)::float8 FROM selected) AS participations,
    (SELECT count(*)::float8 FROM geo_period) AS receipts,
    (SELECT count(*)::float8 FROM active_origins WHERE period_count>=2) AS repeated,
    (SELECT count(*)::float8 FROM "Schedule" s WHERE s."cooperativeId"=${coop} AND s."createdAt">=${period.start} AND s."createdAt"<${period.end}) AS requests_created`);
  return row;
}
async function compare(db: Db, coop: string, q: ParticipationQuery, now: Date) {
  const period = comparablePeriods(q, now),
    current = await metrics(db, coop, q, now),
    previous = await metrics(
      db,
      coop,
      period.previous,
      now,
      period.previousCutoff,
    );
  const [diagnostics] = await db.$queryRaw<Record<string, number>[]>(
    Prisma.sql`${relations(coop, q, now)} SELECT count(*) FILTER(WHERE status IN ${accepted} AND received_at IS NULL)::float8 AS missing_dates,count(*) FILTER(WHERE status IN ${accepted} AND received_at>${now})::float8 AS future_dates,count(*) FILTER(WHERE bucket='CONFLICT')::float8 AS conflicting_links FROM operations`,
  );
  return {
    diagnostics,
    current,
    previous,
    changes: Object.fromEntries(
      Object.keys(current).map((key) => [
        key,
        {
          absolute: current[key] - previous[key],
          percent:
            previous[key] === 0
              ? null
              : ((current[key] - previous[key]) / previous[key]) * 100,
        },
      ]),
    ),
    meta: {
      generatedAt: now,
      currentStart: q.start,
      currentEnd: q.end,
      currentCutoff: period.current.end,
      previousStart: period.previous.start,
      previousEnd: period.previous.end,
      previousCutoff: period.previousCutoff,
      partial: period.current.partial,
    },
    method:
      "Intervalo anterior com a mesma duração. Dia atual parcial compara até o horário equivalente. Participação e recebimentos usam a data de recebimento; pedidos usam a criação em toda a cooperativa. Situações e cadastros são atuais; correções retroativas podem alterar os dois períodos. Sem base anterior, percentual não é calculado. Não comprova causalidade ou completude histórica.",
  };
}
export async function comparisonOverview(
  userId: string,
  q: ParticipationQuery,
  now = new Date(),
) {
  const coop = await reportScope(userId);
  return prisma.$transaction((db) => compare(db, coop.id, q, now), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    timeout: 20000,
  });
}
export async function executiveOverview(
  userId: string,
  q: ParticipationQuery,
  now = new Date(),
) {
  const coop = await reportScope(userId),
    cte = relations(coop.id, q, now);
  return prisma.$transaction(
    async (db) => {
      const comparison = await compare(db, coop.id, q, now);
      const requests = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${classifiedRequests(attendanceRelations(coop.id, q, now))} SELECT outcome,count(*)::float8 AS count FROM classified GROUP BY outcome ORDER BY outcome`,
      );
      const quality = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT count(*) FILTER(WHERE bucket='UNATTRIBUTED')::float8 AS unattributed_receipts,count(*) FILTER(WHERE neighborhood_key='__unknown__')::float8 AS missing_neighborhood,count(*) FILTER(WHERE NOT has_quantity AND coalesce(legacy_kg,0)<=0)::float8 AS unweighed FROM geo_period`,
      );
      const territories = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT coalesce(nullif(min(city_label),''),'Não informado') AS city,coalesce(min(state_label),'') AS state,coalesce(nullif(min(neighborhood_label),''),'Não informado') AS neighborhood,count(*)::float8 AS receipts FROM geo_period GROUP BY city_key,state_key,neighborhood_key ORDER BY receipts DESC,city_key,state_key,neighborhood_key`,
      );
      const materials = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT m.unit::text AS unit,sum(m.quantity)::text AS quantity,count(DISTINCT m."collectionId")::float8 AS receipts FROM geo_period o JOIN "CollectionMaterial" m ON m."collectionId"=o.id GROUP BY m.unit ORDER BY m.unit`,
      );
      const [usage] = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${usageRelations(coop.id, q)} SELECT count(*)::float8 AS accounts,count(*) FILTER(WHERE days>0)::float8 AS measured_accounts,coalesce(sum(seconds),0)::float8 AS seconds FROM rows`,
      );
      return {
        cooperative: { name: coop.name },
        meta: {
          generatedAt: now,
          start: q.start,
          end: q.end,
          filters: q,
          timezone: "America/Fortaleza",
          snapshot: "REPEATABLE_READ",
        },
        comparison,
        requests,
        quality: quality[0],
        territories,
        materials,
        usage,
        notes: [
          "Participação: período, geografia e perfil selecionados. Recebimentos e materiais: período e geografia, em todos os perfis.",
          "Pedidos: criados no período em toda a cooperativa, classificados pela situação atual. Ordens extras não são somadas novamente.",
          "Uso: contas com vínculo atual, no período, em toda a cooperativa; estimativa disponível somente a partir dos clientes atualizados.",
          "Quantidades registradas por unidade, sem converter litros em massa. Podem aguardar conferência. Peso legado não discriminado não foi somado aos materiais.",
          "Resumo integral, sem limitar os totais à página das tabelas. Busca por nome, subaba e material escolhido no mapa não restringem este resumo geral.",
        ],
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}
