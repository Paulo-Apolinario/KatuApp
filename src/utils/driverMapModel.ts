import type { Collection } from "../types/collection";
import type { RouteItem } from "../services/routeService";
import { collectionOrigin, validCoordinates } from "./collectionOrigin";
export type DriverMapScope = "ROUTE" | "UNASSIGNED" | "ALL";
export const pendingVisit = (c: Collection) =>
  c.status === "PENDING" || c.status === "IN_PROGRESS";
export const archivedVisit = (c: Collection) =>
  c.status === "CANCELLED" ||
  c.cancellationReason === "Substituída por revisão do roteiro fixo";
export function orderedRouteVisits(route: RouteItem | null) {
  const rank = new Map(
    (route?.collectionOrder || []).map((id, index) => [id, index]),
  );
  return [...(route?.collections || [])]
    .filter(
      (c) => c.cancellationReason !== "Substituída por revisão do roteiro fixo",
    )
    .sort(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
}
export function driverMapModel(
  route: RouteItem | null,
  collections: Collection[],
  scope: DriverMapScope,
  showFinished = false,
) {
  const planned = orderedRouteVisits(route),
    byId = new Map(collections.map((c) => [c.id, c]));
  for (const c of planned) byId.set(c.id, c);
  const source =
    scope === "ROUTE"
      ? planned
      : scope === "UNASSIGNED"
        ? [...byId.values()].filter((c) => !c.routeId)
        : [...byId.values()];
  const eligible = source.filter((c) => !archivedVisit(c)),
    pending = eligible.filter(pendingVisit),
    visible = showFinished ? eligible : pending;
  const stops = visible.map((c) => {
    const origin = collectionOrigin(c);
    return {
      collection: c,
      origin,
      sequence:
        scope === "ROUTE" ? planned.findIndex((p) => p.id === c.id) + 1 : null,
      located: validCoordinates(origin?.latitude, origin?.longitude),
      kind:
        c.bin || c.routePoint?.kind === "PEV"
          ? ("pev" as const)
          : ("collection" as const),
    };
  });
  return {
    stops,
    pending,
    next:
      scope === "ALL"
        ? null
        : pending.find((c) => c.status === "IN_PROGRESS") || pending[0] || null,
    missing: stops.filter((s) => !s.located).length,
    finished: eligible.filter((c) => !pendingVisit(c)).length,
  };
}
