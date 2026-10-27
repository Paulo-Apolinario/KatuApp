import type { MapMarkerKind } from "./mapMarkers";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Field } from "../ui/Workspace";
export type MapListPoint = {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  kind?: MapMarkerKind;
  sequence?: number | null;
};
export function MapPointList({
  points,
  selectedId,
  onSelect,
  onShowAll,
}: {
  points: MapListPoint[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onShowAll: () => void;
}) {
  const [search, setSearch] = useState(""),
    [visible, setVisible] = useState(5);
  const selected = points.find((p) => p.id === selectedId),
    filtered = points.filter((p) =>
      `${p.title} ${p.description || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
    );
  const badge = (p: MapListPoint) =>
    p.sequence != null
      ? String(p.sequence)
      : p.kind === "start"
        ? "INI"
        : p.kind === "end"
          ? "FIM"
          : p.sequence === null && (!p.kind || p.kind === "collection")
            ? "COL"
            : p.kind === "pev"
              ? "PEV"
              : p.kind === "collector"
                ? "CAT"
                : p.kind === "location"
                  ? "GPS"
                  : p.kind === "driver"
                    ? "GPS"
                    : p.kind === "cooperative"
                      ? "SE"
                      : String(
                          points
                            .filter((x) => !x.kind || x.kind === "collection")
                            .findIndex((x) => x.id === p.id) + 1,
                        );
  return (
    <View style={s.section}>
      <View style={s.heading}>
        <View>
          <Text style={s.title}>Pontos no mapa</Text>
          <Text style={s.caption}>
            {points.length} ponto(s) com localização
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todos"
          onPress={onShowAll}
          style={s.all}
        >
          <Ionicons name="scan-outline" size={18} color="#047857" />
          <Text style={s.allText}>Ver todos</Text>
        </Pressable>
      </View>
      {selected && (
        <View style={s.selected}>
          <View style={s.selectedHeading}>
            <View style={s.selectedIcon}>
              <Ionicons
                name={
                  selected.kind === "start"
                    ? "flag-outline"
                    : selected.kind === "end"
                      ? "checkmark-circle-outline"
                      : selected.kind === "driver"
                        ? "car-outline"
                        : selected.kind === "collector"
                          ? "person-outline"
                          : selected.kind === "pev"
                            ? "trash-outline"
                            : selected.kind === "cooperative"
                              ? "business-outline"
                              : "location-outline"
                }
                color="#047857"
                size={20}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>PONTO SELECIONADO</Text>
              <Text style={s.selectedTitle}>{selected.title}</Text>
            </View>
          </View>
          {!!selected.description && (
            <Text style={s.address}>{selected.description}</Text>
          )}
          {points.some(
            (p) =>
              p.id !== selected.id &&
              Math.abs(p.latitude - selected.latitude) < 0.00001 &&
              Math.abs(p.longitude - selected.longitude) < 0.00001,
          ) && (
            <View style={{ gap: 6 }}>
              <Text style={s.caption}>Também neste local:</Text>
              {points
                .filter(
                  (p) =>
                    p.id !== selected.id &&
                    Math.abs(p.latitude - selected.latitude) < 0.00001 &&
                    Math.abs(p.longitude - selected.longitude) < 0.00001,
                )
                .map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    accessibilityLabel={p.title}
                    onPress={() => onSelect(p.id)}
                    style={s.all}
                  >
                    <Text style={s.allText}>{p.title}</Text>
                  </Pressable>
                ))}
            </View>
          )}
          {!["driver", "collector", "location"].includes(
            selected.kind || "",
          ) && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Abrir navegação para ${selected.title}`}
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`,
                )
              }
              style={s.navigate}
            >
              <Ionicons name="navigate-outline" size={17} color="white" />
              <Text style={s.navigateText}>Abrir navegação</Text>
              <Ionicons name="open-outline" size={15} color="white" />
            </Pressable>
          )}
        </View>
      )}
      {points.length > 5 && (
        <Field
          label="Buscar pontos no mapa"
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setVisible(5);
          }}
          placeholder="Nome ou endereço"
        />
      )}
      <View style={s.list}>
        {filtered.slice(0, visible).map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`Localizar ${p.title}`}
            accessibilityState={{ selected: p.id === selectedId }}
            onPress={() => onSelect(p.id)}
            style={({ pressed }: any) => [
              s.row,
              p.id === selectedId && s.active,
              pressed && { opacity: 0.75 },
            ]}
          >
            <View
              style={[
                s.badge,
                {
                  backgroundColor:
                    p.kind === "pev"
                      ? "PEV"
                      : p.kind === "collector"
                        ? "CAT"
                        : p.kind === "location"
                          ? "GPS"
                          : p.kind === "driver"
                            ? "#EFF6FF"
                            : p.kind === "cooperative"
                              ? "#EAF5EE"
                              : "#F1F5F9",
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: p.kind === "driver" ? "#1D4ED8" : "#3F5B4C",
                }}
              >
                {badge(p)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={s.rowTitle}>
                {p.title}
              </Text>
              <Text numberOfLines={1} style={s.caption}>
                {p.description || "Localização cadastrada"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#8A9B90" />
          </Pressable>
        ))}
      </View>
      {filtered.length > visible && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisible((v) => v + 5)}
          style={s.more}
        >
          <Text style={s.allText}>
            Mostrar mais {Math.min(5, filtered.length - visible)} pontos
          </Text>
        </Pressable>
      )}
      {!filtered.length && (
        <Text style={s.caption}>Nenhum ponto encontrado.</Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  section: {
    padding: 18,
    backgroundColor: "white",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "#E4EBE6",
  },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: "#17382A" },
  caption: { fontSize: 12, lineHeight: 18, color: "#6A7D70", marginTop: 3 },
  all: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  allText: { color: "#047857", fontSize: 12, fontWeight: "600" },
  selected: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFD9C9",
    borderRadius: 12,
    backgroundColor: "#F4F9F5",
    gap: 12,
  },
  selectedHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectedIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#E3F0E8",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.1,
    color: "#587B65",
    fontWeight: "600",
    marginBottom: 4,
  },
  selectedTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: "#193E2B",
  },
  address: { fontSize: 13, lineHeight: 20, color: "#5F7366" },
  navigate: {
    minHeight: 44,
    backgroundColor: "#047857",
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navigateText: { color: "white", fontSize: 13, fontWeight: "600" },
  list: { gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: "#ECF0ED",
    borderRadius: 8,
  },
  active: { backgroundColor: "#F0F7F2" },
  rowTitle: { fontSize: 13, fontWeight: "600", color: "#2D4837" },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  more: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
