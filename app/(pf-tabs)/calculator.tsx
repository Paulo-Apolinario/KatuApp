import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type Material = {
  name: string;
  value: string;
};

export default function CalculatorScreen() {
  const [month, setMonth] = useState("");
  const [materials, setMaterials] = useState<Material[]>([
    { name: "ALUMÍNIO", value: "" },
    { name: "PLÁSTICO", value: "" },
    { name: "PAPEL", value: "" },
    { name: "VIDRO", value: "" },
    { name: "METAL", value: "" },
    { name: "OUTRO", value: "" },
  ]);

  const [total, setTotal] = useState<number | null>(null);

  const updateMaterial = (index: number, value: string) => {
    const newMaterials = [...materials];
    newMaterials[index].value = value;
    setMaterials(newMaterials);
  };

  const calculateTotal = () => {
    let sum = 0;
    materials.forEach(material => {
      if (material.value) {
        sum += parseFloat(material.value) || 0;
      }
    });
    setTotal(sum);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Header */}
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
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            CALCULADORA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {/* Mês */}
        <View style={{ marginBottom: 25 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 10 }}>
            Mês de geração
          </Text>
          <TextInput
            value={month}
            onChangeText={setMonth}
            placeholder="Ex: Março/2026"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 15,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        {/* Materiais */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 15 }}>
            QUANTIDADE DE RESÍDUOS GERADOS (kg):
          </Text>

          {materials.map((material, index) => (
            <View key={index} style={{ marginBottom: 15 }}>
              <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5, fontWeight: "500" }}>
                {material.name}
              </Text>
              <TextInput
                value={material.value}
                onChangeText={(value) => updateMaterial(index, value)}
                placeholder="0.00 kg"
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
          ))}
        </View>

        {/* Botão Calcular */}
        <TouchableOpacity activeOpacity={0.9} onPress={calculateTotal} style={{ marginBottom: 20 }}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
              CALCULAR
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Resultado */}
        {total !== null && (
          <View style={{
            backgroundColor: "#F0FDF4",
            borderRadius: 16,
            padding: 20,
            alignItems: "center",
            marginBottom: 30,
          }}>
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>Total de Resíduos</Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#028C56" }}>{total.toFixed(2)} kg</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}