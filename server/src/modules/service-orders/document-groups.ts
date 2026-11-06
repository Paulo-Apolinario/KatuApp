import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
/** Only exact immutable movement references define a group; date/material/destination never do. */
export async function stockDocumentGroups(cooperativeId: string) {
  return prisma.$queryRaw<{ parentId: string; childId: string }[]>(Prisma.sql`
    SELECT DISTINCT p.id AS "parentId", c.id AS "childId"
    FROM "InternalDocument" p
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(p.snapshot #> '{dispatch,allocations}')='array' THEN p.snapshot #> '{dispatch,allocations}' ELSE '[]'::jsonb END) a
    JOIN "InternalDocument" c ON c."cooperativeId"=p."cooperativeId" AND c.kind='TRANSPORT_RECORD' AND c."movementId"=a->>'movementId'
    WHERE p."cooperativeId"=${cooperativeId} AND p.kind='STOCK_DISPATCH'
  `);
}
