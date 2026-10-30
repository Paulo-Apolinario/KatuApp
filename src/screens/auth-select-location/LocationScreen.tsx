import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "@/src/services/deviceLocation";
import { registerDraftStore } from "@/src/stores/registerDraftStore";
import PickerMap from "./PickerMap";
import { parsePoint, type Point } from "./coordinates";

export default function LocationScreen() {
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
  }>();
  const draft = registerDraftStore.get("cooperativa");
  const [point, setPoint] = useState<Point | null>(
    () =>
      parsePoint(params.latitude, params.longitude) ??
      parsePoint(draft.latitude, draft.longitude),
  );
  const [latitude, setLatitude] = useState(point ? String(point.latitude) : "");
  const [longitude, setLongitude] = useState(
    point ? String(point.longitude) : "",
  );
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  function pick(p: Point) {
    setPoint(p);
    setLatitude(p.latitude.toFixed(6));
    setLongitude(p.longitude.toFixed(6));
    setDirty(false);
    setError("");
  }
  function applyCoordinates() {
    const next = parsePoint(latitude, longitude);
    if (!next) {
      setError(
        "Informe latitude entre −90 e 90 e longitude entre −180 e 180. Preencha os dois campos.",
      );
      return;
    }
    pick(next);
  }
  async function useGps() {
    setLoading(true);
    setError("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError(
          "Permita o acesso à localização ou selecione o ponto no mapa.",
        );
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      pick(current.coords);
    } catch {
      setError(
        "Não foi possível obter sua localização. Selecione o ponto no mapa ou informe as coordenadas.",
      );
    } finally {
      setLoading(false);
    }
  }
  function confirm() {
    if (!point || dirty || loading) return;
    const latitude = String(point.latitude),
      longitude = String(point.longitude);
    registerDraftStore.set({ profile: "cooperativa", latitude, longitude });
    router.replace({
      pathname: "/(auth)/register",
      params: {
        profile: "cooperativa",
        selectedLatitude: latitude,
        selectedLongitude: longitude,
      },
    });
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#f4f7f6" }}>
      <LinearGradient
        colors={["#123C35", "#17694F"]}
        style={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Voltar ao cadastro"
            onPress={() => router.back()}
            style={{ padding: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Localização da cooperativa</Text>
            <Text style={{ color: "#e8fff1", marginTop: 4 }}>
              Selecione e confirme o ponto exato da sede.
            </Text>
          </View>
        </View>
      </LinearGradient>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
          width: "100%",
          maxWidth: 1000,
          alignSelf: "center",
          gap: 14,
        }}
      >
        <Text style={styles.hint}>
          Toque no mapa para posicionar o marcador. Arraste o pino para ajustar
          ou informe as coordenadas abaixo.
        </Text>
        <PickerMap point={point} onPick={pick} />
        <View style={styles.card}>
          <Text style={styles.heading}>Coordenadas da sede</Text>
          <Text style={styles.hint}>
            Use ponto ou vírgula como separador decimal.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <View style={styles.field}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                accessibilityLabel="Latitude"
                value={latitude}
                onChangeText={(s) => {
                  setLatitude(s);
                  setDirty(true);
                  setError("");
                }}
                placeholder="Ex.: -3.731900"
                keyboardType="numbers-and-punctuation"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                accessibilityLabel="Longitude"
                value={longitude}
                onChangeText={(s) => {
                  setLongitude(s);
                  setDirty(true);
                  setError("");
                }}
                placeholder="Ex.: -38.526700"
                keyboardType="numbers-and-punctuation"
                style={styles.input}
              />
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={applyCoordinates}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>
              Aplicar coordenadas no mapa
            </Text>
          </TouchableOpacity>
          {dirty && (
            <Text style={styles.hint}>
              Aplique as coordenadas para atualizar o marcador antes de
              confirmar.
            </Text>
          )}
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ color: "#92400e" }}
          >
            {error}
          </Text>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          disabled={loading}
          onPress={useGps}
          style={styles.secondary}
        >
          {loading ? (
            <ActivityIndicator color="#047857" />
          ) : (
            <Text style={styles.secondaryText}>Usar minha localização</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !point || dirty || loading }}
          disabled={!point || dirty || loading}
          onPress={confirm}
          style={[
            styles.primary,
            { opacity: !point || dirty || loading ? 0.5 : 1 },
          ]}
        >
          <Text
            style={{ color: "white", fontWeight: "700", textAlign: "center" }}
          >
            Confirmar localização
          </Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          {point
            ? "O ponto será salvo com os demais dados ao concluir o cadastro."
            : "Nenhum ponto selecionado. A visualização inicial de Fortaleza é apenas uma referência."}
        </Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  title: { color: "white", fontSize: 22, fontWeight: "700" },
  heading: { color: "#123c35", fontSize: 16, fontWeight: "700" },
  hint: { color: "#52645e", fontSize: 13, lineHeight: 20 },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#dce5e1",
  },
  field: { flex: 1, minWidth: 140, gap: 6 },
  label: { color: "#123c35", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#c8d5cf",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#123c35",
    backgroundColor: "white",
  },
  secondary: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#047857",
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f0fdf4",
  },
  secondaryText: { color: "#047857", fontWeight: "700", textAlign: "center" },
  primary: { padding: 16, backgroundColor: "#047857", borderRadius: 12 },
});
