import { router } from "expo-router";
import { useState } from "react";
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

import { vehicleService } from "@/src/services/vehicleService";

export default function NovoVeiculoScreen() {
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [year, setYear] = useState("");
  const [capacityKg, setCapacityKg] = useState("");
  const [loading, setLoading] = useState(false);

  function formatPlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  }

  async function handleSalvar() {
    if (!model.trim() || !plate.trim()) {
      Alert.alert("Atenção", "Preencha modelo e placa do veículo.");
      return;
    }

    if (year.trim()) {
      const parsedYear = Number(year);
      if (Number.isNaN(parsedYear) || parsedYear < 1900) {
        Alert.alert("Atenção", "Informe um ano válido.");
        return;
      }
    }

    if (capacityKg.trim()) {
      const parsedCapacity = Number(capacityKg.replace(",", "."));
      if (Number.isNaN(parsedCapacity) || parsedCapacity <= 0) {
        Alert.alert("Atenção", "Informe uma capacidade válida.");
        return;
      }
    }

    try {
      setLoading(true);

      await vehicleService.create({
        model,
        plate,
        brand,
        year,
        capacityKg,
      });

      Alert.alert("Sucesso", "Veículo cadastrado com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/veiculos"),
        },
      ]);
    } catch (error: any) {
      console.error("Erro ao cadastrar veículo:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível cadastrar o veículo."
      );
    } finally {
      setLoading(false);
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
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/veiculos")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVO VEÍCULO
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Modelo *
          </Text>
          <TextInput
            value={model}
            onChangeText={setModel}
            placeholder="Ex: Fiat Fiorino"
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
            Placa *
          </Text>
          <TextInput
            value={plate}
            onChangeText={(text) => setPlate(formatPlate(text))}
            placeholder="ABC1234"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            maxLength={7}
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
            Marca
          </Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="Ex: Fiat"
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
            Ano
          </Text>
          <TextInput
            value={year}
            onChangeText={setYear}
            placeholder="Ex: 2022"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
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

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Capacidade (kg)
          </Text>
          <TextInput
            value={capacityKg}
            onChangeText={setCapacityKg}
            placeholder="Ex: 1200"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
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

        <TouchableOpacity onPress={handleSalvar} disabled={loading} activeOpacity={0.9}>
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
              opacity: loading ? 0.7 : 1,
              marginBottom: 30,
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 18,
                    fontWeight: "800",
                    marginLeft: 10,
                  }}
                >
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                SALVAR VEÍCULO
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}