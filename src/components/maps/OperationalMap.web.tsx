import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";

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

export default function OperationalMapWeb({
  baseLatitude,
  baseLongitude,
  points,
  selectedPointId,
  onSelectPoint,
}: Props) {
  const selectedPoint =
    points.find((point) => point.id === selectedPointId) || null;

  const focusLatitude = selectedPoint?.latitude ?? baseLatitude;
  const focusLongitude = selectedPoint?.longitude ?? baseLongitude;

  const src = `https://www.google.com/maps?q=${focusLatitude},${focusLongitude}&z=13&output=embed`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.mapBox}>
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: "none" } as any}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </View>

      <View style={styles.sidePanel}>
        <Text style={styles.title}>Pontos operacionais</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => onSelectPoint?.("__base__")}
            style={[
              styles.card,
              !selectedPointId || selectedPointId === "__base__"
                ? styles.cardActive
                : null,
            ]}
          >
            <Text style={styles.cardTitle}>Base operacional</Text>
            <Text style={styles.cardText}>
              Latitude: {baseLatitude.toFixed(6)} | Longitude: {baseLongitude.toFixed(6)}
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
              <Text style={styles.cardTitle}>{point.title}</Text>
              {!!point.description ? (
                <Text style={styles.cardText}>{point.description}</Text>
              ) : null}
              <Text style={styles.cardText}>
                {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
  },
  mapBox: {
    flex: 2,
    minHeight: 340,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  sidePanel: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardActive: {
    borderColor: "#028C56",
    backgroundColor: "#ECFDF5",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  cardText: {
    fontSize: 12,
    color: "#4B5563",
  },
});