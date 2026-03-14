import { router } from "expo-router";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function PercentualScreen() {
  const materials = [
    { name: "PLÁSTICO", percent: 25, color: "#06B6D4", value: 156 },
    { name: "PAPEL", percent: 20, color: "#EF4444", value: 124 },
    { name: "PILHA", percent: 30, color: "#8B5CF6", value: 187 },
    { name: "BATERIA", percent: 6, color: "#3B82F6", value: 37 },
    { name: "PAPELÃO", percent: 5, color: "#10B981", value: 31 },
    { name: "VIDRO", percent: 14, color: "#F59E0B", value: 87 },
  ];

  const total = materials.reduce((sum, item) => sum + item.value, 0);

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
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            PERCENTUAL DE COLETA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {/* Card Total */}
        <View style={{
          backgroundColor: "#F0FDF4",
          borderRadius: 20,
          padding: 25,
          alignItems: "center",
          marginBottom: 25,
        }}>
          <Text style={{ fontSize: 16, color: "#4B5563", marginBottom: 10 }}>
            Total Reciclado
          </Text>
          <Text style={{ fontSize: 48, fontWeight: "800", color: "#028C56" }}>
            {total} kg
          </Text>
          <View style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            paddingHorizontal: 15,
            paddingVertical: 5,
            marginTop: 10,
          }}>
            <Text style={{ fontSize: 14, color: "#028C56", fontWeight: "600" }}>
              {((total / 1000) * 100).toFixed(1)}% da meta
            </Text>
          </View>
        </View>

        {/* Gráfico de Pizza Simulado com Barras */}
        <View style={{
          backgroundColor: "#F9FAFB",
          borderRadius: 20,
          padding: 20,
          marginBottom: 25,
        }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 20 }}>
            Distribuição por Material
          </Text>

          {materials.map((item, index) => (
            <View key={index} style={{ marginBottom: 15 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color, marginRight: 8 }} />
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "#374151" }}>
                    {item.name}
                  </Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                  {item.percent}% ({item.value}kg)
                </Text>
              </View>
              <View style={{ height: 10, backgroundColor: "#E5E7EB", borderRadius: 5 }}>
                <View style={{
                  width: `${item.percent}%`,
                  height: 10,
                  backgroundColor: item.color,
                  borderRadius: 5,
                }} />
              </View>
            </View>
          ))}
        </View>

        {/* Legenda */}
        <View style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          marginBottom: 30,
        }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 15 }}>
            Legenda
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {materials.map((item, index) => (
              <View key={index} style={{ width: "50%", flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: item.color, marginRight: 8 }} />
                <Text style={{ fontSize: 14, color: "#4B5563" }}>{item.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}