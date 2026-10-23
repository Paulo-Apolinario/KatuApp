import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  cachedInbox,
  loadInbox,
  onInboxChanged,
} from "../services/inboxService";
export function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id;
  const [unread, setUnread] = useState(0);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await loadInbox(userId);
      if (currentUser.current === userId) setUnread(data.unreadCount);
    } catch {
      /* Avisos já obtidos permanecem disponíveis sem conexão. */
    }
  }, [userId]);
  useEffect(() => {
    let alive = true;
    setUnread(0);
    if (!userId) return;
    void cachedInbox(userId)
      .then((data) => {
        if (alive && data) setUnread(data.unreadCount);
      })
      .then(() => {
        if (alive) void refresh();
      });
    const update = () => {
      if (
        alive &&
        AppState.currentState !== "background" &&
        AppState.currentState !== "inactive"
      )
        void refresh();
    };
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    const off = onInboxChanged(update);
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.remove();
      off();
    };
  }, [refresh, userId]);
  if (!user) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 16,
        minHeight: 48,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
      }}
    >
      <Text style={{ color: "#176944", fontWeight: "700" }}>KATUÁ</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Notificações, ${unread} não lidas`}
        onPress={() => router.push("/notifications")}
        style={{
          minWidth: 48,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="notifications-outline" size={24} color="#176944" />
        {unread > 0 && (
          <View
            style={{
              position: "absolute",
              top: 1,
              right: 0,
              backgroundColor: "#B42318",
              borderRadius: 12,
              minWidth: 20,
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                color: "white",
                fontWeight: "700",
                fontSize: 11,
                textAlign: "center",
              }}
            >
              {unread > 99 ? "99+" : unread}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
