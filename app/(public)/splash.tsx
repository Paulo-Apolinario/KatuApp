import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function Splash() {
  return (
    <Pressable
      onPress={() => router.replace("/(public)/access-type")}
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={["#123C35", "#17694F"]}
        start={{ x: 0.05, y: 0.95 }}
        end={{ x: 0.95, y: 0.05 }}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("../../assets/images/logo.png")}
            resizeMode="contain"
            style={{
              width: 92,
              height: 92,
              marginRight: 16,
            }}
          />

          <Text
            style={{
              fontSize: 58,
              fontWeight: "700",
              color: "#FFFFFF",
              letterSpacing: 1,
            }}
          >
            KATUÁ
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
