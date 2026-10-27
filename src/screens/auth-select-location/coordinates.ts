export type Point = { latitude: number; longitude: number };
export const DEFAULT_POINT: Point = { latitude: -3.7319, longitude: -38.5267 };
export function parsePoint(
  latitude?: string,
  longitude?: string,
): Point | null {
  if (!latitude?.trim() || !longitude?.trim()) return null;
  const lat = Number(latitude.trim().replace(",", "."));
  const lng = Number(longitude.trim().replace(",", "."));
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? { latitude: lat, longitude: lng }
    : null;
}
export type PickerMapProps = {
  point: Point | null;
  onPick: (point: Point) => void;
};
