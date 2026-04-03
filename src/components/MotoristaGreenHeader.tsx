import { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type MotoristaGreenHeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
  rightAction?: ReactNode;
};

export function MotoristaGreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: MotoristaGreenHeaderProps) {
  return (
    <LinearGradient
      colors={["#10F35D", "#028C56"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        paddingTop: 48,
        paddingBottom: 18,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            onPress={onBack}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>
              {title}
            </Text>
            <Text style={{ color: "#E8FFF1", fontSize: 13, marginTop: 2 }}>
              {subtitle}
            </Text>
          </View>
        </View>

        {rightAction}
      </View>
    </LinearGradient>
  );
}