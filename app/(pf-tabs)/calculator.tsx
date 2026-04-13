import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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

  const updateMaterial = (index: number, value: string) => {
    const updated = [...materials];
    updated[index].value = value;
    setMaterials(updated);
  };

  const total = useMemo(() => {
    return materials.reduce((sum, material) => {
      const parsed = Number(material.value.replace(",", "."));
      return sum + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);
  }, [materials]);

  const rankedMaterials = useMemo(() => {
    return materials
      .map((item) => ({
        ...item,
        numeric: Number(item.value.replace(",", ".")) || 0,
      }))
      .filter((item) => item.numeric > 0)
      .sort((a, b) => b.numeric - a.numeric);
  }, [materials]);

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <SectionCard>
          <Text style={sectionTitle}>Mês de geração</Text>
          <TextInput
            value={month}
            onChangeText={setMonth}
            placeholder="Ex: Março/2026"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Quantidade de resíduos (kg)</Text>

          {materials.map((material, index) => (
            <View key={material.name} style={{ marginBottom: 14 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: "#028C56",
                  marginBottom: 6,
                  fontWeight: "600",
                }}
              >
                {material.name}
              </Text>
              <TextInput
                value={material.value}
                onChangeText={(value) => updateMaterial(index, value)}
                placeholder="0.00 kg"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                style={inputStyle}
              />
            </View>
          ))}
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Resumo</Text>

          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 6 }}>
              Total estimado
            </Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#028C56" }}>
              {total.toFixed(2)} kg
            </Text>
            <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 8 }}>
              {month ? `Referente a ${month}` : "Informe o mês de referência"}
            </Text>
          </View>
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Materiais com maior volume</Text>

          {rankedMaterials.length > 0 ? (
            rankedMaterials.map((item, index) => (
              <View
                key={item.name}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: index === rankedMaterials.length - 1 ? 0 : 12,
                  marginBottom: index === rankedMaterials.length - 1 ? 0 : 12,
                  borderBottomWidth:
                    index === rankedMaterials.length - 1 ? 0 : 1,
                  borderBottomColor: "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 15, color: "#028C56", fontWeight: "800" }}>
                  {item.numeric.toFixed(2)} kg
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#6B7280" }}>
              Preencha os valores para visualizar o resumo dos materiais.
            </Text>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 14,
      }}
    >
      {children}
    </View>
  );
}

const sectionTitle = {
  fontSize: 16,
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: 12,
};

const inputStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#FFFFFF",
} as const;