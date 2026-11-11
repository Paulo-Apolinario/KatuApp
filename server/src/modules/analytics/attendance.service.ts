import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { reportScope } from "../reports/reports.service";
import { bounds, type ParticipationQuery } from "./participation.schemas";

// These are three independent record populations, NOT an additive funnel.
// An accepted extra order can refer to the same schedule/collection shown in
// the first population. A PEV report is a service notice, never a donation.
export async function participationAttendance(
  userId: string,
  query: ParticipationQuery,
  now = new Date(),
) {
  const coop = await reportScope(userId),
    period = bounds(query, now);
  const cte = Prisma.sql`WITH extra_links AS (
    SELECT e."sourceScheduleId" AS schedule_id FROM "ExtraCollectionOrder" e
      WHERE e."cooperativeId"=${coop.id} AND e."createdAt"<=${now} AND e."sourceScheduleId" IS NOT NULL
    UNION SELECT c."scheduleId" FROM "ExtraCollectionOrder" e
      JOIN "Collection" c ON c.id=e."collectionId" AND c."cooperativeId"=${coop.id} AND c."createdAt"<=${now}
      WHERE e."cooperativeId"=${coop.id} AND e."createdAt"<=${now} AND c."scheduleId" IS NOT NULL
  ), schedules AS (
    SELECT s.id,s."createdAt" AS created_at,s.status::text AS status,c.id AS collection_id,
      CASE WHEN c.status IN ('RECEIVED','SORTING','COMPLETED') AND c."receivedAt"<=${now} THEN c."receivedAt" END AS received_at,
      (c.status IN ('RECEIVED','SORTING','COMPLETED') AND (c."receivedAt" IS NULL OR c."receivedAt">${now})) AS invalid_receipt,
      links.schedule_id IS NOT NULL AS linked,
      (s."generatorId" IS NOT NULL AND g.id IS NULL) AS invalid_link
    FROM "Schedule" s
    LEFT JOIN "Collection" c ON c."scheduleId"=s.id AND c."cooperativeId"=${coop.id} AND c."createdAt"<=${now}
    LEFT JOIN "Generator" g ON g.id=s."generatorId" AND g."cooperativeId"=${coop.id}
    LEFT JOIN extra_links links ON links.schedule_id=s.id
    WHERE s."cooperativeId"=${coop.id} AND s."createdAt">=${period.start} AND s."createdAt"<${period.end}
  ), extras AS (
    SELECT e.id,e."createdAt" AS created_at,e.status,
      CASE WHEN c.status IN ('RECEIVED','SORTING','COMPLETED') AND c."receivedAt"<=${now} THEN c."receivedAt"
        WHEN e."receivedAt"<=${now} THEN e."receivedAt" END AS received_at,
      ((e."collectionId" IS NOT NULL AND c.id IS NULL) OR (e."sourceScheduleId" IS NOT NULL AND s.id IS NULL)
        OR (c."scheduleId" IS NOT NULL AND cs.id IS NULL)) AS invalid_link,
      (e."receivedAt">${now} OR (c.status IN ('RECEIVED','SORTING','COMPLETED') AND (c."receivedAt" IS NULL OR c."receivedAt">${now}))) AS invalid_receipt,
      (s.id IS NOT NULL OR cs.id IS NOT NULL) AS linked
    FROM "ExtraCollectionOrder" e
    LEFT JOIN "Collection" c ON c.id=e."collectionId" AND c."cooperativeId"=${coop.id} AND c."createdAt"<=${now}
    LEFT JOIN "Schedule" s ON s.id=e."sourceScheduleId" AND s."cooperativeId"=${coop.id} AND s."createdAt"<=${now}
    LEFT JOIN "Schedule" cs ON cs.id=c."scheduleId" AND cs."cooperativeId"=${coop.id} AND cs."createdAt"<=${now}
    WHERE e."cooperativeId"=${coop.id} AND e."createdAt">=${period.start} AND e."createdAt"<${period.end}
  ), pevs AS (
    SELECT p.id,p."createdAt" AS created_at,p.status,
      (b.id IS NULL OR (p."collectionId" IS NOT NULL AND c.id IS NULL)) AS invalid_link,
      c.id IS NOT NULL AS linked
    FROM "PevRequest" p
    LEFT JOIN "Bin" b ON b.id=p."binId" AND b."cooperativeId"=${coop.id}
    LEFT JOIN "Collection" c ON c.id=p."collectionId" AND c."cooperativeId"=${coop.id} AND c."createdAt"<=${now}
    WHERE p."cooperativeId"=${coop.id} AND p."createdAt">=${period.start} AND p."createdAt"<${period.end}
  ), records AS (
    SELECT 'SCHEDULE' AS channel,id,created_at,status,
      (status IN ('REQUESTED','SCHEDULED','IN_PROGRESS') AND received_at IS NULL) AS pending,
      received_at,linked,coalesce(invalid_receipt,false) AS invalid_receipt,invalid_link FROM schedules
    UNION ALL SELECT 'EXTRA',id,created_at,status,status IN ('PENDING_REVIEW','NEEDS_INFO'),received_at,linked,coalesce(invalid_receipt,false),invalid_link FROM extras
    UNION ALL SELECT 'PEV',id,created_at,status,status IN ('OPEN','ASSIGNED'),NULL::timestamp,linked,false,invalid_link FROM pevs
  )`;
  return prisma.$transaction(
    async (db) => {
      const channels = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte}
      SELECT channel,count(*)::float8 AS total,
        count(*) FILTER(WHERE pending)::float8 AS pending,
        count(*) FILTER(WHERE received_at IS NOT NULL)::float8 AS received,
        count(*) FILTER(WHERE linked)::float8 AS linked,
        count(*) FILTER(WHERE invalid_link)::float8 AS invalid_links,
        count(*) FILTER(WHERE invalid_receipt)::float8 AS invalid_receipts,
        count(*) FILTER(WHERE pending AND created_at>${now}::timestamp-interval '7 days')::float8 AS pending_under7,
        count(*) FILTER(WHERE pending AND created_at<=${now}::timestamp-interval '7 days' AND created_at>${now}::timestamp-interval '30 days')::float8 AS pending_7to29,
        count(*) FILTER(WHERE pending AND created_at<=${now}::timestamp-interval '30 days')::float8 AS pending_30plus,
        min(created_at) FILTER(WHERE pending) AS oldest_pending_at,
        count(*) FILTER(WHERE received_at>=created_at)::float8 AS duration_sample,
        count(*) FILTER(WHERE received_at<created_at)::float8 AS retrospective,
        percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM (received_at-created_at))/3600)
          FILTER(WHERE received_at>=created_at)::float8 AS median_hours
      FROM records GROUP BY channel ORDER BY channel`);
      const statuses = await db.$queryRaw<
        { channel: string; status: string; count: number }[]
      >(
        Prisma.sql`${cte} SELECT channel,status,count(*)::float8 AS count FROM records GROUP BY channel,status ORDER BY channel,status`,
      );
      return {
        meta: {
          definitionVersion: "attendance-v1",
          generatedAt: now,
          start: query.start,
          end: query.end,
          partial: period.partial,
          timezone: "America/Fortaleza",
          readMode: "CURRENT_STATE_BY_CREATION_DATE",
          filtersApplied: ["start", "end"],
        },
        channels: ["SCHEDULE", "EXTRA", "PEV"].map((channel) => ({
          channel,
          total: 0,
          pending: 0,
          received: 0,
          linked: 0,
          invalid_links: 0,
          invalid_receipts: 0,
          pending_under7: 0,
          pending_7to29: 0,
          pending_30plus: 0,
          oldest_pending_at: null,
          duration_sample: 0,
          retrospective: 0,
          median_hours: null,
          ...channels.find((row) => row.channel === channel),
          statuses: statuses.filter((row) => row.channel === channel),
        })),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}
