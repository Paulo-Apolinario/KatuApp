import { useEffect, useRef, useState } from "react";
import { Linking, Modal, Text, TouchableOpacity, View } from "react-native";
import { LocationStatus } from "./LocationStatus";
import type { useForegroundLocation } from "../hooks/useForegroundLocation";
import * as Location from "../services/deviceLocation";
import { identifyCurrentCity, positionCell, type CurrentCity } from "../services/currentCity";

export function DeviceLocationCard({ location }: { location: ReturnType<typeof useForegroundLocation> }) {
  const { position, active } = location;
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<{ cell: string; city: CurrentCity } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const cell = position ? positionCell(position) : "";
  const currentCell = useRef(cell);
  currentCell.current = cell;
  useEffect(() => {
    setResult(null);
    setError("");
    setBusy(false);
    setConsent(false);
    request.current?.abort();
    request.current = null;
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [cell, active]);

  async function identify() {
    setConsent(false);
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Renovar a leitura depois da confirmação; nunca consultar coordenadas de cadastro/cache antigo.
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (controller.signal.aborted) return;
      timer = setTimeout(() => controller.abort(), 8000);
      const city = await identifyCurrentCity(fresh, controller.signal);
      if (!controller.signal.aborted && currentCell.current === positionCell(fresh)) {
        setResult({ cell: positionCell(fresh), city });
      }
    } catch (reason) {
      if (request.current === controller) {
        setError(controller.signal.aborted ? "A consulta da cidade demorou. Você pode tentar novamente." :
          reason instanceof Error ? reason.message : "Não foi possível identificar a cidade.");
      }
    } finally {
      clearTimeout(timer);
      if (request.current === controller) setBusy(false);
    }
  }

  return (
    <View style={{ marginTop: 12, borderRadius: 14, backgroundColor: "#FFFFFF", padding: 12 }}>
      <Text style={{ fontWeight: "700", color: "#203B2D" }}>Localização do aparelho</Text>
      <LocationStatus {...location} />
      {position && active && (
        <View>
          {result?.cell === cell ? (
            <Text style={{ color: "#203B2D", fontWeight: "600" }}>
              Localidade aproximada: {result.city.name}{result.city.region ? ` · ${result.city.region}` : ""}
            </Text>
          ) : <Text style={{ color: "#526458" }}>A posição já está disponível. Identificar a cidade é opcional.</Text>}
          {!!error && <Text accessibilityLiveRegion="polite" style={{ color: "#8A4B11", marginTop: 6 }}>{error}</Text>}
          <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setConsent(true)} style={{ paddingVertical: 12 }}>
            <Text style={{ color: "#176944", fontWeight: "700" }}>{busy ? "Identificando cidade..." : "Identificar cidade"}</Text>
          </TouchableOpacity>
          {result && <Text style={{ fontSize: 11, color: "#526458" }}>Localidade por BigDataCloud. A precisão da posição é informada pelo aparelho.</Text>}
        </View>
      )}
      <Modal visible={consent && active} transparent animationType="fade" onRequestClose={() => setConsent(false)}>
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 24 }}>
          <View accessibilityViewIsModal style={{ backgroundColor: "#FFFFFF", padding: 24, borderRadius: 18, maxWidth: 480, alignSelf: "center", width: "100%" }}>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "700", color: "#203B2D" }}>Identificar sua cidade?</Text>
            <Text style={{ marginTop: 12, lineHeight: 22, color: "#384E40" }}>Ao continuar, seu aparelho enviará a posição atual ao BigDataCloud. O serviço também recebe seu endereço IP e utiliza esses dados para melhorar sua base de geolocalização. Nenhum nome, e-mail ou dado de coleta será enviado. Você pode continuar usando a posição sem identificar a cidade.</Text>
            <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL("https://www.bigdatacloud.com/privacy-and-cookie-policy")} style={{ paddingVertical: 12 }}>
              <Text style={{ color: "#176944" }}>Política de privacidade do serviço</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={identify} style={{ backgroundColor: "#176944", borderRadius: 10, padding: 14 }}>
              <Text style={{ color: "#FFFFFF", textAlign: "center", fontWeight: "700" }}>Continuar e identificar cidade</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => setConsent(false)} style={{ padding: 14 }}>
              <Text style={{ color: "#384E40", textAlign: "center" }}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
