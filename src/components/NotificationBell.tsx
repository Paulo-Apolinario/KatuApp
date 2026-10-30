import {
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInbox } from "../contexts/InboxContext";
export function NotificationBell({
  tone = "light",
  style,
}: {
  tone?: "light" | "dark";
  style?: StyleProp<ViewStyle>;
}) {
  const { unread } = useInbox();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Notificações, ${unread} não lidas`}
      onPress={() => router.push("/notifications")}
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            tone === "light" ? "rgba(255,255,255,0.16)" : "#EAF5EE",
          flexShrink: 0,
        },
        style,
      ]}
    >
      <Ionicons
        name="notifications-outline"
        size={22}
        color={tone === "light" ? "#FFFFFF" : "#176944"}
      />
      {unread > 0 && (
        <View
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            backgroundColor: "#C43F32",
            borderColor: tone === "light" ? "#17694F" : "#FFFFFF",
            borderWidth: 2,
            borderRadius: 12,
            minWidth: 22,
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "700",
              fontSize: 10,
              textAlign: "center",
              lineHeight: 16,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
