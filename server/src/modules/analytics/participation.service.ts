import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { reportScope, ReportError } from "../reports/reports.service";
import { bounds, type ParticipationQuery } from "./participation.schemas";

type Db = Prisma.TransactionClient;
export const coverageBuckets = [
  "GENERATOR",
  "PF",
  "PEV",
  "DELIVERER",
  "UNATTRIBUTED",
  "CONFLICT",
] as const;
type CoverageBucket = (typeof coverageBuckets)[number];
const accepted = Prisma.sql`('RECEIVED','SORTING','COMPLETED')`;
const fold = (s: Prisma.Sql) =>
  Prisma.sql`translate(lower(regexp_replace(btrim(coalesce(${s},'')), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')`;
const missing = (s: Prisma.Sql) =>
  Prisma.sql`coalesce(nullif(${fold(s)},''),'__unknown__')`;

// One collection is one operation. Materials are tested with EXISTS, never joined
// into the population. All relations are independently restricted to the tenant.
function relations(coop: string, q: ParticipationQuery, now: Date) {
  const p = bounds(q, now);
  const reference = new Date(p.end.getTime() - 1);
  return Prisma.sql`
    WITH raw_collections AS (
      SELECT c.id, c."createdAt" AS created_at, c."receivedAt" AS received_at,
        c."collectedAt" AS collected_at, c.status::text AS status, c."scheduleId" AS schedule_id,
        s."createdAt" AS requested_at, c."totalWeightKg" AS legacy_kg,
        (EXISTS (SELECT 1 FROM "CollectionMaterial" m WHERE m."collectionId"=c.id AND m.quantity>0)) AS has_quantity,
        CASE WHEN (c."generatorId" IS NOT NULL AND g.id IS NULL)
          OR (c."scheduleId" IS NOT NULL AND s.id IS NULL)
          OR (c."binId" IS NOT NULL AND b.id IS NULL)
          OR (c."intakeDelivererId" IS NOT NULL AND d.id IS NULL)
          OR (c."binId" IS NOT NULL AND (c."generatorId" IS NOT NULL OR c."intakeKind"='DIRECT'))
          OR (c."intakeKind"='DIRECT' AND c."generatorId" IS NOT NULL)
          OR (d.id IS NOT NULL AND coalesce(c."intakeKind",'')<>'DIRECT')
          OR (s."generatorId" IS NOT NULL AND (g.id IS NULL OR s."generatorId"<>g.id))
          THEN 'CONFLICT'
          WHEN b.id IS NOT NULL THEN 'PEV'
          WHEN c."intakeKind"='DIRECT' THEN CASE WHEN d.id IS NOT NULL THEN 'DELIVERER' ELSE 'UNATTRIBUTED' END
          WHEN g.id IS NOT NULL THEN 'GENERATOR'
          WHEN u.role='PF' THEN 'PF' ELSE 'UNATTRIBUTED' END AS bucket,
        g.id AS gen_id, g.type::text AS gen_type, u.id AS author_id,
        coalesce(nullif(g."companyName",''),g.name,u."displayName") AS display_name,
        CASE WHEN b.id IS NOT NULL THEN b.city ELSE g.city END AS city_label,
        CASE WHEN b.id IS NOT NULL THEN b.state ELSE g.state END AS state_label,
        CASE WHEN b.id IS NOT NULL THEN b.neighborhood ELSE g.neighborhood END AS neighborhood_label
      FROM "Collection" c
      LEFT JOIN "Generator" g ON g.id=c."generatorId" AND g."cooperativeId"=${coop}
      LEFT JOIN "Schedule" s ON s.id=c."scheduleId" AND s."cooperativeId"=${coop}
      LEFT JOIN "User" u ON u.id=s."requestedByUserId"
      LEFT JOIN "Bin" b ON b.id=c."binId" AND b."cooperativeId"=${coop}
      LEFT JOIN "IntakeDeliverer" d ON d.id=c."intakeDelivererId" AND d."cooperativeId"=${coop}
      WHERE c."cooperativeId"=${coop} AND c."createdAt"<=${now}
    ), operations AS (
      SELECT *, CASE WHEN bucket='GENERATOR' THEN 'GENERATOR:'||gen_id WHEN bucket='PF' THEN 'PF:'||author_id END AS party_key,
        CASE WHEN bucket='GENERATOR' THEN gen_type WHEN bucket='PF' THEN 'PF' END AS profile,
        ${missing(Prisma.sql`city_label`)} AS city_key, ${missing(Prisma.sql`state_label`)} AS state_key,
        ${missing(Prisma.sql`neighborhood_label`)} AS neighborhood_key
      FROM raw_collections
    ), confirmed AS (
      SELECT * FROM operations WHERE status IN ${accepted} AND received_at IS NOT NULL
        AND received_at<=${now} AND received_at<${p.end}
    ), history AS (
      SELECT party_key, min(received_at) AS first_at, max(received_at) AS last_at,
        count(*)::float8 AS history_count,
        count(*) FILTER (WHERE (received_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date >= (${reference}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date-6)::float8 AS days7,
        count(*) FILTER (WHERE (received_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date >= (${reference}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date-29)::float8 AS days30,
        count(*) FILTER (WHERE (received_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date >= (${reference}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date-59)::float8 AS days60
      FROM confirmed WHERE party_key IS NOT NULL GROUP BY party_key
    ), geo_period AS (
      SELECT * FROM confirmed WHERE received_at>=${p.start}
        ${geo(q)}
    ), selected AS (
      SELECT * FROM geo_period WHERE party_key IS NOT NULL ${profile(q)}
    ), raw_requests AS (
      SELECT s.id, s."createdAt" AS created_at, s.status::text AS status, s."scheduledDate" AS scheduled_at,
        CASE WHEN EXISTS (SELECT 1 FROM operations o WHERE o.schedule_id=s.id AND o.party_key IS NULL) THEN NULL
          WHEN g.id IS NOT NULL THEN 'GENERATOR:'||g.id
          WHEN s."generatorId" IS NULL AND u.role='PF' THEN 'PF:'||u.id END AS party_key,
        CASE WHEN g.id IS NOT NULL THEN g.type::text WHEN s."generatorId" IS NULL AND u.role='PF' THEN 'PF' END AS profile,
        coalesce(nullif(g."companyName",''),g.name,CASE WHEN u.role='PF' THEN u."displayName" END) AS display_name,
        g.city AS city_label, g.state AS state_label, g.neighborhood AS neighborhood_label,
        ${missing(Prisma.sql`g.city`)} AS city_key, ${missing(Prisma.sql`g.state`)} AS state_key,
        ${missing(Prisma.sql`g.neighborhood`)} AS neighborhood_key,
        EXISTS (SELECT 1 FROM operations c WHERE c.schedule_id=s.id AND c.status IN ${accepted} AND c.received_at<=${now}) AS has_received
      FROM "Schedule" s
      LEFT JOIN "Generator" g ON g.id=s."generatorId" AND g."cooperativeId"=${coop}
      LEFT JOIN "User" u ON u.id=s."requestedByUserId"
      WHERE s."cooperativeId"=${coop} AND s."createdAt"<=${now}
    ), requests AS (
      SELECT * FROM raw_requests WHERE created_at>=${p.start} AND created_at<${p.end}
        AND party_key IS NOT NULL ${geo(q)} ${profile(q)}
    ), active_origins AS (
      SELECT party_key, max(display_name) AS name, max(profile) AS profile,
        max(city_label) AS city, max(state_label) AS state, max(neighborhood_label) AS neighborhood,
        count(*)::float8 AS period_count FROM selected GROUP BY party_key
    ), request_origins AS (
      SELECT party_key, max(display_name) AS name, max(profile) AS profile,
        max(city_label) AS city, max(state_label) AS state, max(neighborhood_label) AS neighborhood,
        count(*) FILTER (WHERE status IN ('REQUESTED','SCHEDULED','IN_PROGRESS') AND NOT has_received)::float8 AS open_requests
      FROM requests GROUP BY party_key
    ), people AS (
      SELECT coalesce(a.party_key,r.party_key) AS party_key, coalesce(a.name,r.name) AS name,
        coalesce(a.profile,r.profile) AS profile, coalesce(a.city,r.city) AS city, coalesce(a.state,r.state) AS state,
        coalesce(a.neighborhood,r.neighborhood) AS neighborhood,
        coalesce(a.period_count,0)::float8 AS period_count, coalesce(r.open_requests,0)::float8 AS open_requests,
        h.first_at, h.last_at, coalesce(h.history_count,0)::float8 AS history_count,
        coalesce(h.days7,0)::float8 AS days7, coalesce(h.days30,0)::float8 AS days30, coalesce(h.days60,0)::float8 AS days60,
        ((${reference}::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date - (h.last_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date) AS recency_days
      FROM active_origins a FULL JOIN request_origins r ON a.party_key=r.party_key
      LEFT JOIN history h ON h.party_key=coalesce(a.party_key,r.party_key)
    )`;
}
function geo(q: ParticipationQuery) {
  return Prisma.sql`${q.city ? Prisma.sql`AND city_key=${q.city}` : Prisma.empty}
    ${q.state ? Prisma.sql`AND state_key=${q.state}` : Prisma.empty}
    ${q.neighborhood ? Prisma.sql`AND neighborhood_key=${q.neighborhood}` : Prisma.empty}`;
}
function profile(q: ParticipationQuery) {
  return q.profile ? Prisma.sql`AND profile=${q.profile}` : Prisma.empty;
}
function meta(q: ParticipationQuery, now: Date) {
  const p = bounds(q, now);
  return {
    definitionVersion: "participation-v1",
    generatedAt: now,
    referenceAt: p.end,
    timezone: "America/Fortaleza",
    readMode: "CURRENT_STATE_BY_EVENT_DATE",
    partial: p.partial,
    start: q.start,
    end: q.end,
    effectiveStart: p.start,
    effectiveEnd: p.end,
    population: "Pessoas físicas e geradores identificados",
    filters: q,
  };
}
async function pagedPeople(db: Db, cte: Prisma.Sql, q: ParticipationQuery) {
  const search = q.search.replace(/[\\%_]/g, "\\$&");
  const where = search
    ? Prisma.sql`WHERE name ILIKE ${"%" + search + "%"}`
    : Prisma.empty;
  const [count] = await db.$queryRaw<{ total: number }[]>(
    Prisma.sql`${cte} SELECT count(*)::float8 AS total FROM people ${where}`,
  );
  const items = await db.$queryRaw<
    Record<string, unknown>[]
  >(Prisma.sql`${cte} SELECT * FROM people ${where}
    ORDER BY last_at DESC NULLS LAST, party_key ASC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
  return {
    items,
    page: q.page,
    pageSize: q.pageSize,
    total: count.total,
    totalPages: Math.ceil(count.total / q.pageSize),
  };
}

export async function participationContext(userId: string) {
  const coop = await reportScope(userId);
  const locations = await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT ${missing(Prisma.sql`city`)} AS city_key, ${missing(Prisma.sql`state`)} AS state_key,
      ${missing(Prisma.sql`neighborhood`)} AS neighborhood_key,
      coalesce(nullif(btrim(city),''),'Município não informado') AS city,
      coalesce(nullif(btrim(state),''),'UF não informada') AS state,
      coalesce(nullif(btrim(neighborhood),''),'Bairro não informado') AS neighborhood
    FROM (SELECT city,state,neighborhood FROM "Generator" WHERE "cooperativeId"=${coop.id}
      UNION ALL SELECT city,state,neighborhood FROM "Bin" WHERE "cooperativeId"=${coop.id}) l
    ORDER BY city_key,state_key,neighborhood_key,city,state,neighborhood`);
  return {
    locations,
    definitionVersion: "participation-v1",
    neighborhoodSource: "Cadastro atual",
    digitalActivityAvailable: false,
  };
}

export async function participationOverview(
  userId: string,
  q: ParticipationQuery,
  now = new Date(),
) {
  const coop = await reportScope(userId),
    cte = relations(coop.id, q, now),
    p = bounds(q, now);
  return prisma.$transaction(
    async (db) => {
      const [summary] = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte} SELECT
      (SELECT count(*)::float8 FROM active_origins) AS active,
      (SELECT count(*)::float8 FROM active_origins a JOIN history h USING(party_key) WHERE h.first_at>=${p.start}) AS first_registered,
      (SELECT count(*)::float8 FROM active_origins a JOIN history h USING(party_key) WHERE h.first_at<${p.start}) AS returning,
      (SELECT count(*)::float8 FROM selected) AS participations,
      (SELECT count(*)::float8 FROM active_origins WHERE period_count>=2) AS repeated,
      (SELECT count(*)::float8 FROM requests WHERE status IN ('REQUESTED','SCHEDULED','IN_PROGRESS') AND NOT has_received) AS open_requests`);
      const coverage = await db.$queryRaw<{ bucket: string; count: number }[]>(
        Prisma.sql`${cte} SELECT bucket,count(*)::float8 AS count FROM geo_period GROUP BY bucket ORDER BY bucket`,
      );
      const series = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte} SELECT to_char(date_trunc(${q.group},received_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza'),'YYYY-MM-DD') AS date,
      count(*)::float8 AS operations,count(DISTINCT party_key)::float8 AS participants FROM selected GROUP BY 1 ORDER BY 1`);
      const neighborhoods = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte} SELECT city_key,state_key,neighborhood_key,
      coalesce(nullif(btrim(min(city_label)),''),'Município não informado') AS city, coalesce(min(state_label),'') AS state,
      coalesce(nullif(min(neighborhood_label),''),'Bairro não informado') AS neighborhood,
      count(*)::float8 AS operations,count(DISTINCT party_key)::float8 AS participants
      FROM selected GROUP BY city_key,state_key,neighborhood_key ORDER BY operations DESC,city_key,state_key,neighborhood_key`);
      const [quality] = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte} SELECT
      count(*)::float8 AS historical_operations,
      count(*) FILTER (WHERE status IN ${accepted})::float8 AS historical_receipts,
      (SELECT count(*)::float8 FROM geo_period) AS period_receipts,
      (SELECT count(*)::float8 FROM raw_requests WHERE created_at>=${p.start} AND created_at<${p.end}) AS period_requests,
      count(*) FILTER (WHERE status IN ${accepted} AND received_at IS NULL)::float8 AS missing_received_date,
      count(*) FILTER (WHERE status IN ${accepted} AND received_at>${now})::float8 AS future_received_date,
      count(*) FILTER (WHERE bucket='CONFLICT')::float8 AS conflicting_relations,
      (SELECT count(*)::float8 FROM geo_period WHERE NOT has_quantity AND coalesce(legacy_kg,0)<=0) AS unweighed,
      (SELECT count(*)::float8 FROM geo_period WHERE NOT has_quantity AND legacy_kg>0) AS legacy_weight,
      (SELECT count(*)::float8 FROM geo_period WHERE neighborhood_key='__unknown__') AS missing_neighborhood,
      (SELECT count(*)::float8 FROM raw_requests WHERE created_at>=${p.start} AND created_at<${p.end} AND party_key IS NULL) AS unattributed_requests,
      (SELECT count(*)::float8 FROM raw_requests WHERE created_at>=${p.start} AND created_at<${p.end} AND has_received AND status IN ('REQUESTED','SCHEDULED','IN_PROGRESS')) AS request_status_mismatch
      FROM operations`);
      const requestsByStatus = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT status,count(*)::float8 AS count FROM requests GROUP BY status ORDER BY status`,
      );
      const participants = await pagedPeople(db, cte, q);
      return {
        meta: meta(q, now),
        summary,
        coverage,
        coverageTotals: {
          received: coverage.reduce((total, row) => total + row.count, 0),
          identified: coverage
            .filter((row) => ["GENERATOR", "PF"].includes(row.bucket))
            .reduce((total, row) => total + row.count, 0),
        },
        series,
        neighborhoods,
        quality,
        requestsByStatus,
        participants,
        coverageScope:
          "Todos os perfis, no período e na seleção geográfica; o filtro de perfil afeta os indicadores principais.",
        qualityScope:
          "Datas ausentes/futuras e relações conflitantes: histórico da cooperativa. Pesagem e bairro: recebimentos do período na seleção geográfica. Demandas sem origem e situação divergente: criadas no período, toda a cooperativa.",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}

export async function participationCoverage(
  userId: string,
  q: ParticipationQuery,
  bucket: CoverageBucket,
  id?: string,
  now = new Date(),
) {
  const coop = await reportScope(userId);
  const cte = Prisma.sql`${relations(coop.id, q, now)}, coverage_rows AS (
    SELECT o.*,CASE WHEN o.bucket IN ('GENERATOR','PF') THEN coalesce(o.display_name,'Nome não informado')
      WHEN o.bucket='PEV' THEN coalesce(nullif(b.name,''),b."binId",'PEV')
      WHEN o.bucket='DELIVERER' THEN coalesce(d.name,'Entregador avulso')
      WHEN o.bucket='CONFLICT' THEN 'Vínculos a conferir'
      ELSE coalesce(nullif(e.payload->>'originName',''),'Origem não identificada') END AS origin,
      e.id AS extra_order_id,
      (SELECT count(*)::float8 FROM "CollectionMaterial" m WHERE m."collectionId"=o.id) AS material_count
    FROM geo_period o
    JOIN "Collection" c ON c.id=o.id AND c."cooperativeId"=${coop.id}
    LEFT JOIN "Bin" b ON b.id=c."binId" AND b."cooperativeId"=${coop.id}
    LEFT JOIN "IntakeDeliverer" d ON d.id=c."intakeDelivererId" AND d."cooperativeId"=${coop.id}
    LEFT JOIN "ExtraCollectionOrder" e ON e."collectionId"=c.id AND e."cooperativeId"=${coop.id}
    WHERE o.bucket=${bucket}
  )`;
  return prisma.$transaction(
    async (db) => {
      if (id) {
        // Resolve against the filtered, tenant-scoped coverage BEFORE reading materials.
        const [item] = await db.$queryRaw<
          Record<string, unknown>[]
        >(Prisma.sql`${cte}
        SELECT id,bucket,origin,status,received_at,collected_at,requested_at,created_at,city_label,state_label,neighborhood_label,
          material_count,has_quantity,legacy_kg,extra_order_id FROM coverage_rows WHERE id=${id}`);
        if (!item)
          throw new ReportError(
            "Recebimento não encontrado nesta categoria e seleção.",
            404,
          );
        const materials = await db.collectionMaterial.findMany({
          where: { collectionId: id, collection: { cooperativeId: coop.id } },
          select: { id: true, nameSnapshot: true, quantity: true, unit: true },
          orderBy: [{ nameSnapshot: "asc" }, { id: "asc" }],
        });
        return { meta: meta(q, now), bucket, item, materials };
      }
      const search = q.search.replace(/[\\%_]/g, "\\$&");
      const where = search
        ? Prisma.sql`WHERE (origin ILIKE ${"%" + search + "%"} OR id ILIKE ${"%" + search + "%"})`
        : Prisma.empty;
      const [total] = await db.$queryRaw<{ total: number }[]>(
        Prisma.sql`${cte} SELECT count(*)::float8 AS total FROM coverage_rows ${where}`,
      );
      const items = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte}
      SELECT id,bucket,origin,status,received_at,collected_at,city_label,state_label,neighborhood_label,material_count,extra_order_id
      FROM coverage_rows ${where} ORDER BY received_at DESC,id ASC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
      return {
        meta: meta(q, now),
        bucket,
        items,
        page: q.page,
        pageSize: q.pageSize,
        total: total.total,
        totalPages: Math.ceil(total.total / q.pageSize),
        scope:
          "Todos os perfis; mesmo período e seleção geográfica do quadro de cobertura.",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}

export async function participationPeople(
  userId: string,
  q: ParticipationQuery,
  now = new Date(),
) {
  const coop = await reportScope(userId);
  return prisma.$transaction(
    async (db) => ({
      meta: meta(q, now),
      ...(await pagedPeople(db, relations(coop.id, q, now), q)),
    }),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}

export async function participationDetail(
  userId: string,
  q: ParticipationQuery,
  kind: "PF" | "GENERATOR",
  id: string,
  now = new Date(),
) {
  const coop = await reportScope(userId),
    cte = relations(coop.id, q, now),
    key = kind + ":" + id;
  return prisma.$transaction(
    async (db) => {
      const [person] = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT * FROM people WHERE party_key=${key}`,
      );
      if (!person)
        throw new ReportError(
          "Participante não encontrado nesta seleção.",
          404,
        );
      const [regularity] = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte}, dates AS (
      SELECT DISTINCT (received_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date AS day FROM confirmed WHERE party_key=${key}
    ), intervals AS (SELECT day-lag(day) OVER(ORDER BY day) AS days FROM dates)
    SELECT (SELECT count(*)::float8 FROM dates) AS dates,
      CASE WHEN count(days)>=2 THEN percentile_cont(0.5) WITHIN GROUP(ORDER BY days)::float8 END AS median_days,
      CASE WHEN count(days)>=2 THEN stddev_pop(days)::float8 END AS deviation_days FROM intervals`);
      const [total] = await db.$queryRaw<
        { count: number }[]
      >(Prisma.sql`${cte}, timeline AS (
      SELECT id FROM operations WHERE party_key=${key} AND created_at<${bounds(q, now).end}
      UNION ALL SELECT r.id FROM raw_requests r WHERE party_key=${key} AND created_at<${bounds(q, now).end}
        AND NOT EXISTS(SELECT 1 FROM operations o WHERE o.schedule_id=r.id)
    ) SELECT count(*)::float8 AS count FROM timeline`);
      const timeline = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte}, timeline AS (
      SELECT id,'COLLECTION' AS kind,status,created_at,received_at,collected_at,requested_at,schedule_id,
        coalesce(received_at,collected_at,created_at) AS date FROM operations WHERE party_key=${key} AND created_at<${bounds(q, now).end}
      UNION ALL SELECT r.id,'SCHEDULE',status,created_at,NULL::timestamp,NULL::timestamp,created_at,r.id,created_at
        FROM raw_requests r WHERE party_key=${key} AND created_at<${bounds(q, now).end}
        AND NOT EXISTS(SELECT 1 FROM operations o WHERE o.schedule_id=r.id)
    ) SELECT * FROM timeline ORDER BY date DESC,id ASC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`);
      return {
        meta: meta(q, now),
        person,
        regularity,
        timeline,
        pagination: { page: q.page, pageSize: q.pageSize, total: total.count },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}
