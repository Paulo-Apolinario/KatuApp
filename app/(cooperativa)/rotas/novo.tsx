import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function isBrazilianDate(value: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim());
}

function normalizeStopsInput(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function NovaRotaScreen() {
  const [name, setName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [stopsInput, setStopsInput] = useState("");
  const [description, setDescription] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const stopsPreview = useMemo(
    () => normalizeStopsInput(stopsInput),
    [stopsInput]
  );

  const availableDrivers = useMemo(
    () => drivers.filter((item) => item.status !== "INACTIVE"),
    [drivers]
  );

  const availableVehicles = useMemo(
    () => vehicles.filter((item) => item.status !== "INACTIVE"),
    [vehicles]
  );

  const loadOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);

      const [driversData, vehiclesData] = await Promise.all([
        driverService.list(),
        vehicleService.list(),
      ]);

      setDrivers(driversData);
      setVehicles(vehiclesData);
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
    if (!name.trim()) {
      Alert.alert("Atenção", "Informe o nome da rota.");
      return;
    }

    if (!scheduledDate.trim()) {
      Alert.alert("Atenção", "Informe a data programada.");
      return;
    }

    if (!isBrazilianDate(scheduledDate)) {
      Alert.alert(
        "Data inválida",
        "Informe a data no formato DD/MM/AAAA. Ex: 16/03/2026."
      );
      return;
    }

    if (!driverId) {
      Alert.alert("Atenção", "Selecione um motorista.");
      return;
    }

    if (!vehicleId) {
      Alert.alert("Atenção", "Selecione um veículo.");
      return;
    }

    const stops = normalizeStopsInput(stopsInput);

    if (stops.length === 0) {
      Alert.alert("Atenção", "Informe pelo menos uma parada da rota.");
      return;
    }

    try {
      setSaving(true);

      await routeService.create({
        name: name.trim(),
        scheduledDate: scheduledDate.trim(),
        driverId,
        vehicleId,
        stops,
        description: description.trim() || undefined,
      });

      Alert.alert("Sucesso", "Rota cadastrada com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/rotas"),
        },
      ]);
    } catch (error: any) {
      console.error("Erro ao cadastrar rota:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível cadastrar a rota."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 52,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.replace("/(cooperativa)/rotas")}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: "#FFFFFF",
            }}
          >
            NOVA ROTA
          </Text>

          <TouchableOpacity onPress={loadOptions}>
            <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 24,
            fontWeight: "800",
            marginTop: 16,
          }}
        >
          Criar operação
        </Text>

        <Text
          style={{
            color: "#FFFFFF",
            opacity: 0.92,
            marginTop: 6,
            fontSize: 14,
          }}
        >
          Defina a rota, veículo, motorista e paradas planejadas.
        </Text>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Dados principais
          </Text>

          <FieldLabel label="Nome da rota *" />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex: Rota Centro Manhã"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />

          <FieldLabel label="Data programada *" />
          <TextInput
            value={scheduledDate}
            onChangeText={setScheduledDate}
            placeholder="Ex: 16/03/2026"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            style={inputStyle}
          />

          <FieldLabel label="Descrição" />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Observações operacionais da rota"
            placeholderTextColor="#9CA3AF"
            multiline
            style={textareaStyle}
          />
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Equipe e veículo
          </Text>

          {loadingOptions ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color="#028C56" />
              <Text style={{ marginTop: 8, color: "#6B7280" }}>
                Carregando opções...
              </Text>
            </View>
          ) : (
            <>
              <FieldLabel label="Motorista *" />
              {availableDrivers.length === 0 ? (
                <EmptyInline text="Nenhum motorista disponível." />
              ) : (
                <View style={chipsWrapStyle}>
                  {availableDrivers.map((item) => {
                    const selected = driverId === item.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setDriverId(item.id)}
                        style={chipStyle(selected)}
                      >
                        <Text style={chipTextStyle(selected)}>
                          {item.name}
                          {item.cnhCategory ? ` • ${item.cnhCategory}` : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <FieldLabel label="Veículo *" />
              {availableVehicles.length === 0 ? (
                <EmptyInline text="Nenhum veículo disponível." />
              ) : (
                <View style={chipsWrapStyle}>
                  {availableVehicles.map((item) => {
                    const selected = vehicleId === item.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setVehicleId(item.id)}
                        style={chipStyle(selected)}
                      >
                        <Text style={chipTextStyle(selected)}>
                          {item.model} • {item.plate}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Paradas da rota
          </Text>

          <FieldLabel label="Paradas *" />
          <TextInput
            value={stopsInput}
            onChangeText={setStopsInput}
            placeholder="Separe por vírgula. Ex: Cooperativa, Mercado Central, Praia"
            placeholderTextColor="#9CA3AF"
            multiline
            style={textareaStyle}
          />

          <Text
            style={{
              marginTop: 10,
              color: "#6B7280",
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            Dica: use a ordem real da operação. A primeira parada pode ser a
            cooperativa e depois os pontos de coleta.
          </Text>

          <View
            style={{
              marginTop: 14,
              backgroundColor: "#F9FAFB",
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: "#374151",
                marginBottom: 10,
              }}
            >
              Prévia das paradas ({stopsPreview.length})
            </Text>

            {stopsPreview.length > 0 ? (
              stopsPreview.map((stop, index) => (
                <View
                  key={`${stop}-${index}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#DCFCE7",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: "#166534",
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={{ color: "#374151", flex: 1 }}>{stop}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: "#6B7280" }}>
                Nenhuma parada informada ainda.
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSalvar}
          disabled={saving}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 54,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: saving ? 0.7 : 1,
              marginBottom: 16,
            }}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: "800",
                    marginLeft: 10,
                  }}
                >
                  SALVANDO...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: "800",
                    marginLeft: 10,
                  }}
                >
                  SALVAR ROTA
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 14,
        color: "#028C56",
        marginBottom: 8,
        fontWeight: "700",
      }}
    >
      {label}
    </Text>
  );
}

function EmptyInline({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: "#F9FAFB",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
      }}
    >
      <Text style={{ color: "#6B7280" }}>{text}</Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#FFFFFF",
  marginBottom: 16,
} as const;

const textareaStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#FFFFFF",
  minHeight: 110,
  textAlignVertical: "top" as const,
} as const;

const chipsWrapStyle = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  marginBottom: 16,
};

function chipStyle(selected: boolean) {
  return {
    backgroundColor: selected ? "#028C56" : "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: selected ? "#028C56" : "#E5E7EB",
  } as const;
}

function chipTextStyle(selected: boolean) {
  return {
    color: selected ? "#FFFFFF" : "#374151",
    fontWeight: "700" as const,
    fontSize: 13,
  };
}