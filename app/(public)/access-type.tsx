import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type EntryButtonProps = {
  title: string;
  onPress: () => void;
};

function EntryButton({ title, onPress }: EntryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginBottom: 18,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          minHeight: 58,
          borderRadius: 14,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>

        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
  );
}

export default function AccessTypeScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <View style={{ width: "100%", maxWidth: 360 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 46,
          }}
        >
          <Image
            source={require("../../assets/images/logo.png")}
            resizeMode="contain"
            style={{
              width: 58,
              height: 58,
              marginRight: 12,
            }}
          />

          <Text
            style={{
              fontSize: 28,
              color: "#111827",
              fontWeight: "700",
            }}
          >
            KATU
          </Text>
        </View>

        <EntryButton
          title="GERADOR"
          onPress={() => router.push("/(public)/choose-profile")}
        />

        <EntryButton
          title="COOPERATIVA"
          onPress={() => router.push("/(cooperativa)/login")}
        />

        <EntryButton
          title="CATADOR"
          onPress={() => router.push("/(catador)/homecat")}
        /> {/* 👈 TAG FECHADA CORRETAMENTE */}
      </View>
    </View>
  );
}