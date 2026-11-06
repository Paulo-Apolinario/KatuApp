import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
export const operationFilter = (
  operation?: string,
): Prisma.InternalDocumentWhereInput =>
  operation === "STOCK_EXIT"
    ? {
        OR: [
          { kind: "STOCK_DISPATCH" },
          { kind: "TRANSPORT_RECORD", movementId: { not: null } },
        ],
      }
    : operation === "DESTINATION"
      ? {
          OR: [
            { kind: "DESTINATION_RECORD" },
            { kind: "TRANSPORT_RECORD", destinationId: { not: null } },
          ],
        }
      : operation === "COLLECTION"
        ? {
            kind: {
              notIn: [
                "STOCK_DISPATCH",
                "DESTINATION_RECORD",
                "TRANSPORT_RECORD",
              ],
            },
          }
        : {};

/** Only a compact presentation of immutable emission data is returned on lists. */
export function documentContext(document: {
  snapshot: Prisma.JsonValue;
  kind: string;
  lotId: string | null;
}) {
  const s = (document.snapshot || {}) as any;
  const dispatch = s.dispatch,
    movement = s.movement,
    destination = s.destination,
    exit = dispatch || movement || destination;
  const collections: any[] = Array.isArray(s.collections)
    ? s.collections.filter(
        (c: any) => !s.subjectCollectionId || c.id === s.subjectCollectionId,
      )
    : [];
  const allocations: any[] = Array.isArray(dispatch?.allocations)
    ? dispatch.allocations
    : [];
  const materials = exit
    ? [
        {
          name:
            dispatch?.materialName || s.material || "Material não informado",
          quantity: exit.quantity ?? null,
          unit: exit.unit || "",
        },
      ]
    : collections.flatMap((c) =>
        (Array.isArray(c.materials) && c.materials.length
          ? c.materials
          : c.expectedMaterials || []
        ).map((m: any) => ({
          name: m.name,
          quantity: m.quantity ?? null,
          unit: m.unit || "",
        })),
      );
  return {
    operation:
      dispatch || movement
        ? "STOCK_EXIT"
        : destination
          ? "DESTINATION"
          : "COLLECTION",
    operationKind: exit?.kind || exit?.type || null,
    materialCount: materials.length,
    materials: materials.slice(0, 6),
    destinationName: exit?.destinationName || null,
    destinationAddress: exit?.destinationAddress || null,
    operationDate:
      dispatch?.movementDate ||
      movement?.movementDate ||
      destination?.destinationDate ||
      null,
    lotCount: allocations.length || (document.lotId || s.lot?.id ? 1 : 0),
    lots: allocations.length
      ? allocations
          .slice(0, 6)
          .map((a) => ({ id: a.lotId, code: a.lotCode || a.lotId }))
      : document.lotId || s.lot?.id
        ? [
            {
              id: document.lotId || s.lot.id,
              code: s.lot?.code || document.lotId || s.lot.id,
            },
          ]
        : [],
    origins: [
      ...new Set(collections.map((c) => c.origin).filter(Boolean)),
    ].slice(0, 4),
    routeName: s.route?.name || null,
    operationId: dispatch?.operationId || null,
  };
}
export function withDocumentContext<
  T extends { snapshot: Prisma.JsonValue; kind: string; lotId: string | null },
>(document: T) {
  const { snapshot, ...fields } = document;
  return { ...fields, context: documentContext(document) };
}
/** Parameterized, accent-insensitive search across meaningful fields, including historic lot codes.
 * IDs are not truncated before pagination; matching documents always remain cooperative-scoped.
 */
export async function matchingDocumentIds(cooperativeId: string, term: string) {
  if (!term) return [];
  const tokens = term
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const conditions = tokens.map(
    (t) =>
      Prisma.sql`candidate.search_text LIKE ${"%" + t.replace(/[\\%_]/g, "\\$&") + "%"}`,
  );
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT candidate.id FROM (
      SELECT d.id, translate(lower(concat_ws(' ',d.id,d.number,d."collectionId",d."lotId",l.code,l."lotCode",
        d.snapshot #>> '{dispatch,operationId}',d.snapshot #>> '{dispatch,materialName}',d.snapshot #>> '{dispatch,destinationName}',d.snapshot #>> '{dispatch,quantity}',
        d.snapshot #>> '{movement,destinationName}',d.snapshot #>> '{destination,destinationName}',d.snapshot #>> '{lot,code}',d.snapshot->>'material',d.snapshot #>> '{route,name}',
        (SELECT string_agg(concat_ws(' ',a->>'lotId',a->>'lotCode'),' ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.snapshot #> '{dispatch,allocations}')='array' THEN d.snapshot #> '{dispatch,allocations}' ELSE '[]'::jsonb END) a),
        (SELECT string_agg(concat_ws(' ',c->>'origin',c->>'id',c->>'scheduleId',c->'materials',c->'expectedMaterials'),' ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d.snapshot->'collections')='array' THEN d.snapshot->'collections' ELSE '[]'::jsonb END) c)
      )), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS search_text
      FROM "InternalDocument" d LEFT JOIN "WasteStockLot" l ON l.id=d."lotId" AND l."cooperativeId"=d."cooperativeId"
      WHERE d."cooperativeId"=${cooperativeId}
    ) candidate WHERE ${Prisma.join(conditions, " AND ")}
  `);
  return rows.map((row) => row.id);
}
