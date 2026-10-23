import type { Collection } from "../types/collection";
export function collectionOrigin(collection?: Collection | null): {
  id?: string;
  name: string;
  companyName?: string | null;
  businessName?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
} | null {
  if (!collection) return null;
  if (collection.extraOrder && collection.schedule?.pickupAddress)
    return {
      id: collection.id,
      name: collection.generator?.name || "Coleta extra",
      address: collection.schedule.pickupAddress,
      latitude: collection.schedule.pickupLatitude,
      longitude: collection.schedule.pickupLongitude,
    };
  const origin =
    collection.bin || collection.generator || collection.schedule?.generator;
  if (origin) {
    const o = origin as Record<string, any>;
    return {
      ...o,
      name: o.name || o.binId || "Ponto de coleta",
      address:
        o.address ||
        o.location ||
        [o.street, o.number, o.neighborhood, o.city, o.state]
          .filter(Boolean)
          .join(", "),
      latitude: o.latitude,
      longitude: o.longitude,
    };
  }
  const schedule = collection.schedule;
  return schedule?.pickupAddress
    ? {
        id: schedule.id || collection.id,
        name: "Solicitação de pessoa física",
        address: schedule.pickupAddress,
        latitude: schedule.pickupLatitude,
        longitude: schedule.pickupLongitude,
      }
    : null;
}
export function validCoordinates(lat: unknown, lng: unknown) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180
  );
}
