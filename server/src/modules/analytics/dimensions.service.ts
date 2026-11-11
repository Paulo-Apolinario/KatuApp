import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { reportScope } from "../reports/reports.service";
import { relations } from "./participation.service";
import type { ParticipationQuery } from "./participation.schemas";
const materialKey = Prisma.sql`CASE WHEN m."wasteTypeId" IS NOT NULL THEN 'C:'||m."wasteTypeId" ELSE 'N:'||lower(btrim(m."nameSnapshot")) END||':'||m.unit::text`;

export async function territoryOverview(
  userId: string,
  q: ParticipationQuery,
  now = new Date(),
  selectedMaterial = "",
) {
  const coop = await reportScope(userId),
    cte = relations(coop.id, q, now);
  return prisma.$transaction(
    async (db) => {
      const materialOptions = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT ${materialKey} AS key,min(m."nameSnapshot") AS name,m.unit::text AS unit,count(DISTINCT o.id)::float8 AS receipts FROM geo_period o JOIN "CollectionMaterial" m ON m."collectionId"=o.id GROUP BY ${materialKey},m.unit ORDER BY name,m.unit`,
      );
      const basis = Prisma.sql`${cte}, amounts AS (SELECT m."collectionId" AS id,sum(m.quantity) AS quantity,min(m.unit::text) AS unit FROM "CollectionMaterial" m JOIN geo_period o ON o.id=m."collectionId" WHERE ${materialKey}=${selectedMaterial} GROUP BY m."collectionId"), territory_basis AS (SELECT o.*,a.quantity,a.unit FROM geo_period o LEFT JOIN amounts a ON a.id=o.id ${selectedMaterial ? Prisma.sql`WHERE a.id IS NOT NULL` : Prisma.empty})`;
      const items = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${basis}
    SELECT city_key,state_key,neighborhood_key,coalesce(nullif(min(city_label),''),'Município não informado') AS city,
      coalesce(min(state_label),'') AS state,coalesce(nullif(min(neighborhood_label),''),'Bairro não informado') AS neighborhood,
      count(*)::float8 AS receipts,count(*) FILTER(WHERE party_key IS NOT NULL)::float8 AS identified_receipts,
      count(DISTINCT party_key)::float8 AS participants,count(*) FILTER(WHERE bucket='PEV')::float8 AS pev_receipts,
      count(*) FILTER(WHERE bucket<>'CONFLICT' AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND NOT(latitude=0 AND longitude=0))::float8 AS located,
      avg(latitude) FILTER(WHERE bucket<>'CONFLICT' AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND NOT(latitude=0 AND longitude=0)) AS latitude,
      avg(longitude) FILTER(WHERE bucket<>'CONFLICT' AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND NOT(latitude=0 AND longitude=0)) AS longitude
      ,sum(quantity)::text AS quantity,min(unit) AS unit
    FROM territory_basis GROUP BY city_key,state_key,neighborhood_key ORDER BY receipts DESC,city_key,state_key,neighborhood_key`);
      return {
        items,
        materialOptions,
        selectedMaterial,
        meta: { generatedAt: now, start: q.start, end: q.end },
        scope:
          "Recebimentos por bairro do cadastro atual, em todos os perfis. O filtro geográfico e o período se aplicam; perfil não se aplica. PEV indica o bairro do ponto, não a residência de seus usuários.",
        mapMethod:
          "Intensidade por bairro com posição média dos pontos cadastrados que têm coordenadas válidas. Os círculos não representam limites oficiais dos bairros. Registros sem coordenadas ou bairro permanecem na lista.",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}

export async function collectorsOverview(
  userId: string,
  q: ParticipationQuery,
  now = new Date(),
) {
  const coop = await reportScope(userId);
  const search = q.search.replace(/[\\%_]/g, "\\$&");
  const cte = Prisma.sql`${relations(coop.id, q, now)}, members AS (
    SELECT p."collectorId" AS collector_id,o.id AS collection_id,o.received_at FROM geo_period o
      JOIN "CollectionParticipant" p ON p."collectionId"=o.id
    UNION SELECT c."collectorId",o.id,o.received_at FROM geo_period o JOIN "Collection" c ON c.id=o.id AND c."cooperativeId"=${coop.id}
      WHERE c."collectorId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "CollectionParticipant" p WHERE p."collectionId"=o.id)
  ), rows AS (
    SELECT c.id,c.name,c."userId" AS user_id,c.status::text AS status,count(m.collection_id)::float8 AS receipts,
      count(DISTINCT (m.received_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Fortaleza')::date)::float8 AS days,
      max(m.received_at) AS last_receipt FROM "Collector" c LEFT JOIN members m ON m.collector_id=c.id
    WHERE c."cooperativeId"=${coop.id} GROUP BY c.id
  )`;
  return prisma.$transaction(
    async (db) => {
      const [summary] = await db.$queryRaw<
        Record<string, unknown>[]
      >(Prisma.sql`${cte} SELECT count(*)::float8 AS registered,count(*) FILTER(WHERE receipts>0)::float8 AS active,
      (SELECT count(DISTINCT m.collection_id)::float8 FROM members m JOIN "Collector" c ON c.id=m.collector_id AND c."cooperativeId"=${coop.id}) AS receipts FROM rows`);
      const where = search
        ? Prisma.sql`WHERE name ILIKE ${"%" + search + "%"}`
        : Prisma.empty;
      const [total] = await db.$queryRaw<{ total: number }[]>(
        Prisma.sql`${cte} SELECT count(*)::float8 AS total FROM rows ${where}`,
      );
      const items = await db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`${cte} SELECT * FROM rows ${where} ORDER BY receipts DESC,name,id LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      );
      return {
        summary,
        items,
        total: total.total,
        page: q.page,
        pageSize: q.pageSize,
        meta: { generatedAt: now, start: q.start, end: q.end },
        scope:
          "Participação em coletas recebidas no período e na seleção geográfica, em todos os perfis. Cada membro conta uma participação na coleta de equipe; a soma das participações individuais não equivale a coletas únicas. Dias são datas de recebimento, não dias trabalhados ou jornada. Pesos e divisão da produção permanecem nos relatórios da operação.",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}
