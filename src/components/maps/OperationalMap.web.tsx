import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";

export type OperationalMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  color?: string;
};

type Props = {
  baseLatitude: number;
  baseLongitude: number;
  points: OperationalMapPoint[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  selectedPointId?: string | null;
  onSelectPoint?: (pointId: string) => void;
};

function truncateText(value?: string, max = 90) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
}

function openGoogleMaps(latitude: number, longitude: number) {
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export default function OperationalMapWeb({
  baseLatitude,
  baseLongitude,
  points,
  selectedPointId,
  onSelectPoint,
}: Props) {
  const { width } = useWindowDimensions();
  const isMobileLayout = width < 900;

  const selectedPoint =
    points.find((point) => point.id === selectedPointId) || null;

  const focusLatitude = selectedPoint?.latitude ?? baseLatitude;
  const focusLongitude = selectedPoint?.longitude ?? baseLongitude;

  const src = `https://www.google.com/maps?q=${focusLatitude},${focusLongitude}&z=13&output=embed`;

  return (
    <View
      style={[
        styles.wrapper,
        isMobileLayout ? styles.wrapperMobile : styles.wrapperDesktop,
      ]}
    >
      <View
        style={[
          styles.mapSection,
          isMobileLayout ? styles.mapSectionMobile : styles.mapSectionDesktop,
        ]}
      >
        <View
          style={[
            styles.mapBox,
            isMobileLayout ? styles.mapBoxMobile : styles.mapBoxDesktop,
          ]}
        >
          <iframe
            src={src}
            style={{
              width: "100%",
              height: "100%",
              border: "0",
              display: "block",
            } as any}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </View>

        <View style={styles.legendBar}>
          <Text style={styles.legendTitle}>Legenda</Text>

          <View style={styles.legendItems}>
            <LegendItem color="#028C56" label="Base / cooperativa" />
            <LegendItem color="#2563EB" label="Ponto operacional" />
            <LegendItem color="#111827" label="Selecionado" />
            <LegendItem color="#F59E0B" label="Coleta / parada" />
          </View>
        </View>

        <View style={styles.quickActions}>
          <QuickActionButton
            label="Base"
            onPress={() => onSelectPoint?.("__base__")}
          />
          {!!selectedPoint && (
            <QuickActionButton
              label="Abrir no Maps"
              onPress={() =>
                openGoogleMaps(selectedPoint.latitude, selectedPoint.longitude)
              }
              primary
            />
          )}
        </View>
      </View>

      <View
        style={[
          styles.panel,
          isMobileLayout ? styles.panelMobile : styles.panelDesktop,
        ]}
      >
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.title}>Pontos operacionais</Text>
            <Text style={styles.subtitle}>
              {points.length} ponto{points.length === 1 ? "" : "s"} disponível
              {points.length === 1 ? "" : "is"}
            </Text>
          </View>
        </View>

        {!!selectedPoint && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedCardHeader}>
              <View
                style={[
                  styles.pointDotLarge,
                  { backgroundColor: selectedPoint.color || "#028C56" },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedTitle}>{selectedPoint.title}</Text>
                <Text style={styles.selectedSubtitle}>Ponto selecionado</Text>
              </View>
            </View>

            {!!selectedPoint.description && (
              <Text style={styles.selectedDescription}>
                {selectedPoint.description}
              </Text>
            )}

            <Text style={styles.selectedCoordinates}>
              Latitude: {selectedPoint.latitude.toFixed(6)}
            </Text>
            <Text style={styles.selectedCoordinates}>
              Longitude: {selectedPoint.longitude.toFixed(6)}
            </Text>

            <View style={styles.selectedActions}>
              <TouchableOpacity
                onPress={() => openGoogleMaps(selectedPoint.latitude, selectedPoint.longitude)}
                style={[styles.selectedActionButton, styles.selectedActionPrimary]}
              >
                <Text style={styles.selectedActionPrimaryText}>
                  Abrir no Google Maps
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onSelectPoint?.("__base__")}
                style={[styles.selectedActionButton, styles.selectedActionSecondary]}
              >
                <Text style={styles.selectedActionSecondaryText}>
                  Voltar para base
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isMobileLayout ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mobileCardsContent}
          >
            <TouchableOpacity
              onPress={() => onSelectPoint?.("__base__")}
              style={[
                styles.mobileCard,
                !selectedPointId || selectedPointId === "__base__"
                  ? styles.cardActive
                  : null,
              ]}
            >
              <View style={styles.badgeBase}>
                <Text style={styles.badgeText}>BASE</Text>
              </View>

              <Text style={styles.cardTitle}>Base operacional</Text>
              <Text style={styles.cardText}>
                Latitude: {baseLatitude.toFixed(6)}
              </Text>
              <Text style={styles.cardText}>
                Longitude: {baseLongitude.toFixed(6)}
              </Text>
            </TouchableOpacity>

            {points.map((point) => (
              <TouchableOpacity
                key={point.id}
                onPress={() => onSelectPoint?.(point.id)}
                style={[
                  styles.mobileCard,
                  selectedPointId === point.id ? styles.cardActive : null,
                ]}
              >
                <View
                  style={[
                    styles.pointDot,
                    { backgroundColor: point.color || "#028C56" },
                  ]}
                />

                <Text style={styles.cardTitle}>{truncateText(point.title, 42)}</Text>

                {!!point.description ? (
                  <Text style={styles.cardText}>
                    {truncateText(point.description, 78)}
                  </Text>
                ) : null}

                <Text style={styles.cardCoordinates}>
                  {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                </Text>

                <TouchableOpacity
                  onPress={() => openGoogleMaps(point.latitude, point.longitude)}
                  style={styles.inlineMapButton}
                >
                  <Text style={styles.inlineMapButtonText}>Abrir Maps</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.desktopCardsContent}
          >
            <TouchableOpacity
              onPress={() => onSelectPoint?.("__base__")}
              style={[
                styles.card,
                !selectedPointId || selectedPointId === "__base__"
                  ? styles.cardActive
                  : null,
              ]}
            >
              <View style={styles.badgeBase}>
                <Text style={styles.badgeText}>BASE</Text>
              </View>

              <Text style={styles.cardTitle}>Base operacional</Text>
              <Text style={styles.cardText}>
                Latitude: {baseLatitude.toFixed(6)}
              </Text>
              <Text style={styles.cardText}>
                Longitude: {baseLongitude.toFixed(6)}
              </Text>
            </TouchableOpacity>

            {points.map((point) => (
              <TouchableOpacity
                key={point.id}
                onPress={() => onSelectPoint?.(point.id)}
                style={[
                  styles.card,
                  selectedPointId === point.id ? styles.cardActive : null,
                ]}
              >
                <View style={styles.rowTop}>
                  <View
                    style={[
                      styles.pointDot,
                      { backgroundColor: point.color || "#028C56" },
                    ]}
                  />
                  <Text style={[styles.cardTitle, { flex: 1 }]}>
                    {point.title}
                  </Text>
                </View>

                {!!point.description ? (
                  <Text style={styles.cardText}>{point.description}</Text>
                ) : null}

                <Text style={styles.cardCoordinates}>
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </Text>

                <TouchableOpacity
                  onPress={() => openGoogleMaps(point.latitude, point.longitude)}
                  style={styles.inlineMapButton}
                >
                  <Text style={styles.inlineMapButtonText}>Abrir Maps</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function QuickActionButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.quickActionButton,
        primary ? styles.quickActionButtonPrimary : styles.quickActionButtonSecondary,
      ]}
    >
      <Text
        style={[
          styles.quickActionText,
          primary ? styles.quickActionTextPrimary : styles.quickActionTextSecondary,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    minHeight: 340,
  },

  wrapperDesktop: {
    flexDirection: "row",
  },

  wrapperMobile: {
    flexDirection: "column",
  },

  mapSection: {
    backgroundColor: "#FFFFFF",
  },

  mapSectionDesktop: {
    flex: 2,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },

  mapSectionMobile: {
    width: "100%",
  },

  mapBox: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },

  mapBoxDesktop: {
    height: 360,
    minHeight: 360,
  },

  mapBoxMobile: {
    width: "100%",
    height: 340,
    minHeight: 340,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  legendBar: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },

  legendTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 14,
    marginBottom: 6,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 6,
  },

  legendText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },

  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },

  quickActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },

  quickActionButtonPrimary: {
    backgroundColor: "#028C56",
    borderColor: "#028C56",
  },

  quickActionButtonSecondary: {
    backgroundColor: "#F8FAFC",
    borderColor: "#DDE5EC",
  },

  quickActionText: {
    fontSize: 12,
    fontWeight: "800",
  },

  quickActionTextPrimary: {
    color: "#FFFFFF",
  },

  quickActionTextSecondary: {
    color: "#334155",
  },

  panel: {
    backgroundColor: "#F8FAFC",
  },

  panelDesktop: {
    flex: 1,
    minWidth: 310,
    padding: 14,
  },

  panelMobile: {
    width: "100%",
    paddingTop: 14,
    paddingBottom: 10,
  },

  panelHeader: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },

  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },

  selectedCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 16,
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  selectedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  pointDotLarge: {
    width: 16,
    height: 16,
    borderRadius: 999,
    marginRight: 10,
  },

  selectedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },

  selectedSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  selectedDescription: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 10,
  },

  selectedCoordinates: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "600",
  },

  selectedActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },

  selectedActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },

  selectedActionPrimary: {
    backgroundColor: "#028C56",
    borderColor: "#028C56",
  },

  selectedActionSecondary: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
  },

  selectedActionPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  selectedActionSecondaryText: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
  },

  desktopCardsContent: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },

  mobileCardsContent: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingRight: 24,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },

  mobileCard: {
    width: 270,
    minHeight: 178,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
  },

  cardActive: {
    borderColor: "#028C56",
    backgroundColor: "#ECFDF5",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  pointDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 2,
  },

  badgeBase: {
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },

  badgeText: {
    color: "#065F46",
    fontSize: 10,
    fontWeight: "800",
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  cardText: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 18,
  },

  cardCoordinates: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 10,
    fontWeight: "600",
  },

  inlineMapButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#C7D8FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  inlineMapButtonText: {
    color: "#2E63E6",
    fontSize: 12,
    fontWeight: "800",
  },
});