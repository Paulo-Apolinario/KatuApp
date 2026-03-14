import { router } from "expo-router";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function RankingScreen() {
  const rankingData = [
    { name: "GABRIEL", kg: 34, position: 1 },
    { name: "NILTON BRAZ", kg: 17, position: 2 },
    { name: "SALATYEL", kg: 15, position: 3 },
    { name: "JADE", kg: 14, position: 4 },
    { name: "MARIA", kg: 12, position: 5 },
    { name: "JOÃO", kg: 10, position: 6 },
    { name: "ANA", kg: 9, position: 7 },
    { name: "PEDRO", kg: 8, position: 8 },
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
          paddingBottom: 30,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
              RANKING
            </Text>
          </View>
          <Ionicons name="trophy" size={30} color="#FFFFFF" />
        </View>

        {/* Pódio */}
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 20 }}>
          <View style={{ alignItems: "center" }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 5,
            }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#C0C0C0" }}>2</Text>
            </View>
            <Text style={{ fontSize: 14, color: "#FFFFFF", fontWeight: "600" }}>{rankingData[1].name}</Text>
            <Text style={{ fontSize: 12, color: "#FFFFFF", opacity: 0.9 }}>{rankingData[1].kg}kg</Text>
          </View>

          <View style={{ alignItems: "center", marginTop: -20 }}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 5,
              borderWidth: 2,
              borderColor: "#FFD700",
            }}>
              <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFD700" }}>1</Text>
            </View>
            <Text style={{ fontSize: 16, color: "#FFFFFF", fontWeight: "700" }}>{rankingData[0].name}</Text>
            <Text style={{ fontSize: 14, color: "#FFFFFF", opacity: 0.9 }}>{rankingData[0].kg}kg</Text>
          </View>

          <View style={{ alignItems: "center" }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 5,
            }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#CD7F32" }}>3</Text>
            </View>
            <Text style={{ fontSize: 14, color: "#FFFFFF", fontWeight: "600" }}>{rankingData[2].name}</Text>
            <Text style={{ fontSize: 12, color: "#FFFFFF", opacity: 0.9 }}>{rankingData[2].kg}kg</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Lista */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {rankingData.slice(3).map((item, index) => (
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
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{
                width: 30,
                fontSize: 16,
                fontWeight: "600",
                color: index + 4 <= 3 ? "#028C56" : "#6B7280",
              }}>
                {index + 4}º
              </Text>
              <Text style={{ fontSize: 16, color: "#111827", fontWeight: "500", marginLeft: 10 }}>
                {item.name}
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: "#028C56", fontWeight: "700" }}>{item.kg}kg</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}