import { router } from "expo-router";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function HistoryScreen() {
  const historyData = [
    { date: "05/03/2026", materials: "Papel, Plástico", kg: 12 },
    { date: "28/02/2026", materials: "Vidro, Metal", kg: 8 },
    { date: "20/02/2026", materials: "Alumínio", kg: 5 },
    { date: "15/02/2026", materials: "Papelão, Plástico", kg: 15 },
    { date: "10/02/2026", materials: "Metal, Vidro", kg: 7 },
    { date: "05/02/2026", materials: "Papel, Alumínio", kg: 10 },
  ];

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
            HISTÓRICO DE COLETAS
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {/* Total */}
        <View style={{
          backgroundColor: "#F0FDF4",
          borderRadius: 16,
          padding: 20,
          alignItems: "center",
          marginBottom: 25,
        }}>
          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>Total Coletado</Text>
          <Text style={{ fontSize: 36, fontWeight: "800", color: "#028C56" }}>57 kg</Text>
        </View>

        {/* Lista */}
        {historyData.map((item, index) => (
          <View
            key={index}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 15,
              borderBottomWidth: 1,
              borderBottomColor: "#F3F4F6",
            }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>{item.date}</Text>
              <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>{item.materials}</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#028C56" }}>{item.kg} kg</Text>
          </View>
        ))}

        <TouchableOpacity style={{ marginTop: 20, marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", fontWeight: "600", textAlign: "center" }}>
            CARREGAR MAIS
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}