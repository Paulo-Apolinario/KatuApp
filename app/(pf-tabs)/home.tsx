import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#0F172A" }}>
        Home KATUA
      </Text>
    </View>
  );
}