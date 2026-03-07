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
        colors={["#1EF07A", "#069C63"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 86,
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
            fontSize: 18,
            fontWeight: "700",
            flex: 1,
            paddingRight: 12,
          }}
        >
          {title}
        </Text>

        <Ionicons name={icon} size={30} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );
}