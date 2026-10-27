export type MapMarkerKind =
  | "collection"
  | "cooperative"
  | "driver"
  | "collector"
  | "pev"
  | "location"
  | "start"
  | "end";
export type OperationalMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  color?: string;
  kind?: MapMarkerKind;
  sequence?: number | null;
  includeInBounds?: boolean;
};
export const markerSymbols = {
  start: {
    icon: "flag-outline",
    label: "Partida",
    path: '<path d="M5 22V3m0 1h14l-4 5 4 5H5"/>',
  },
  end: {
    icon: "checkmark-circle-outline",
    label: "Chegada",
    path: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
  },
  driver: {
    icon: "car-outline",
    label: "Motorista",
    path: '<path d="m5 9 2-5h10l2 5M4 9h16v9H4zM7 18v2m10-2v2M7 13h1m8 0h1"/>',
  },
  collector: {
    icon: "person-outline",
    label: "Catador",
    path: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-4a7 7 0 0 1 14 0v4M9 21v-5m6 5v-5"/>',
  },
  cooperative: {
    icon: "business-outline",
    label: "Sede",
    path: '<path d="M5 21V3h14v18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3"/>',
  },
  pev: {
    icon: "trash-outline",
    label: "PEV",
    path: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  },
  location: {
    icon: "navigate-outline",
    label: "Minha posição",
    path: '<path d="m4 11 16-7-7 16-2-9z"/>',
  },
  collection: {
    icon: "location-outline",
    label: "Coleta",
    path: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  },
} as const;
export function markerColor(
  kind: MapMarkerKind = "collection",
  color?: string,
  selected = false,
) {
  return selected
    ? "#0F2F28"
    : /^#[a-f\d]{6}$/i.test(color || "")
      ? color!
      : kind === "driver"
        ? "#2563EB"
        : kind === "collector"
          ? "#087F8C"
          : kind === "pev"
            ? "#B45309"
            : kind === "location"
              ? "#2563EB"
              : "#047857";
}
export function markerSvg(
  kind: MapMarkerKind = "collection",
  label = "",
  color?: string,
  selected = false,
  sequence?: number | null,
) {
  const symbol = markerSymbols[kind] || markerSymbols.collection,
    fill = markerColor(kind, color, selected),
    number = /^\d{1,3}$/.test(label) ? label : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="56" viewBox="0 0 46 56" aria-hidden="true"><path d="M23 53 8 35A21 21 0 1 1 38 35Z" fill="${fill}" stroke="white" stroke-width="3"/><g transform="translate(11 9)" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${number ? `<text x="12" y="17" fill="white" stroke="none" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="700">${number}</text>` : symbol.path}</g>${kind !== "collection" && Number.isInteger(sequence) && sequence! > 0 && sequence! < 1000 ? `<circle cx="9" cy="9" r="8" fill="white" stroke="${fill}" stroke-width="1.5"/><text x="9" y="12" fill="${fill}" text-anchor="middle" font-size="9" font-family="Arial,sans-serif" font-weight="700">${sequence}</text>` : ""}</svg>`;
}
