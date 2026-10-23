import { LinearGradient } from "expo-linear-gradient";
import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function GradientButton({ title, icon, onPress }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        marginBottom: 18,
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={["#123C35", "#17694F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 64,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 18,
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "700",
            flex: 1,
            paddingRight: 12,
          }}
        >
          {title}
        </Text>

        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}
