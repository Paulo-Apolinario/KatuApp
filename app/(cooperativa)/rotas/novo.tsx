import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { driverService, type Driver } from "@/src/services/driverService";
import { vehicleService, type Vehicle } from "@/src/services/vehicleService";
import { routeService } from "@/src/services/routeService";

export default function NovaRotaScreen() {
  const [name, setName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [stops, setStops] = useState("");
  const [description, setDescription] = useState("");

  const [motoristas, setMotoristas] = useState<Driver[]>([]);
  const [veiculos, setVeiculos] = useState<Vehicle[]>([]);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);

      const [driversData, vehiclesData] = await Promise.all([
        driverService.list(),
        vehicleService.list(),
      ]);

      setMotoristas(driversData);
      setVeiculos(vehiclesData);
    } catch (error) {
      console.error("Erro ao carregar opções da rota:", error);
      Alert.alert("Erro", "Não foi possível carregar motoristas e veículos.");
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  async function handleSalvar() {
    if (!name.trim() || !scheduledDate.trim() || !stops.trim() || !driverId || !vehicleId) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }

    const stopsArray = stops
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (stopsArray.length === 0) {
      Alert.alert("Atenção", "Informe pelo menos um ponto da rota.");
      return;
    }

    try {
      setSaving(true);

      await routeService.create({
        name,
        scheduledDate,
        driverId,
        vehicleId,
        stops: stopsArray,
        description,
      });

      Alert.alert("Sucesso", "Rota cadastrada com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/rotas"),
        },
      ]);
    } catch (error: any) {
      console.error("Erro ao cadastrar rota:", error);
      Alert.alert("Erro", error?.message || "Não foi possível cadastrar a rota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/rotas")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVA ROTA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Nome da rota *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex: Rota Centro Manhã"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Data programada *
          </Text>
          <TextInput
            value={scheduledDate}
            onChangeText={setScheduledDate}
            placeholder="2026-03-16T08:00:00.000Z"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        {loadingOptions ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator color="#028C56" />
            <Text style={{ marginTop: 8, color: "#6B7280" }}>Carregando opções...</Text>
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
                Motorista *
              </Text>

              {motoristas.length === 0 ? (
                <Text style={{ color: "#6B7280" }}>Nenhum motorista cadastrado.</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {motoristas.map((item) => {
                    const selected = driverId === item.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setDriverId(item.id)}
                        style={{
                          backgroundColor: selected ? "#028C56" : "#F3F4F6",
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 10,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#FFFFFF" : "#4B5563",
                            fontWeight: "600",
                          }}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
                Veículo *
              </Text>

              {veiculos.length === 0 ? (
                <Text style={{ color: "#6B7280" }}>Nenhum veículo cadastrado.</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {veiculos.map((item) => {
                    const selected = vehicleId === item.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setVehicleId(item.id)}
                        style={{
                          backgroundColor: selected ? "#028C56" : "#F3F4F6",
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 10,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#FFFFFF" : "#4B5563",
                            fontWeight: "600",
                          }}
                        >
                          {item.model} - {item.plate}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Pontos da rota *
          </Text>
          <TextInput
            value={stops}
            onChangeText={setStops}
            placeholder="Separe por vírgula. Ex: Centro, Mercado, Praia"
            placeholderTextColor="#9CA3AF"
            multiline
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
              minHeight: 100,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Descrição
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Observações da rota"
            placeholderTextColor="#9CA3AF"
            multiline
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
              minHeight: 100,
              textAlignVertical: "top",
            }}
          />
        </View>

        <TouchableOpacity onPress={handleSalvar} disabled={saving} activeOpacity={0.9}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: saving ? 0.7 : 1,
              marginBottom: 30,
            }}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginLeft: 10 }}>
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                SALVAR ROTA
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}