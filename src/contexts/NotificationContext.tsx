import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Animated, Platform, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type NotificationType = "success" | "error" | "warning" | "info";

type NotifyOptions = {
  title?: string;
  message: string;
  type?: NotificationType;
  duration?: number;
};

type NotificationContextData = {
  notify: (options: NotifyOptions) => void;
  notifySuccess: (message: string, title?: string) => void;
  notifyError: (message: string, title?: string) => void;
  notifyWarning: (message: string, title?: string) => void;
  notifyInfo: (message: string, title?: string) => void;
};

const NotificationContext = createContext<NotificationContextData>(
  {} as NotificationContextData
);

export function useNotification() {
  return useContext(NotificationContext);
}

function getNotificationStyle(type: NotificationType) {
  switch (type) {
    case "success":
      return {
        icon: "checkmark-circle-outline" as const,
        background: "#ECFDF5",
        border: "#86EFAC",
        title: "#166534",
        text: "#14532D",
      };
    case "error":
      return {
        icon: "close-circle-outline" as const,
        background: "#FEF2F2",
        border: "#FCA5A5",
        title: "#991B1B",
        text: "#7F1D1D",
      };
    case "warning":
      return {
        icon: "warning-outline" as const,
        background: "#FFFBEB",
        border: "#FCD34D",
        title: "#92400E",
        text: "#78350F",
      };
    default:
      return {
        icon: "information-circle-outline" as const,
        background: "#EFF6FF",
        border: "#93C5FD",
        title: "#1E40AF",
        text: "#1E3A8A",
      };
  }
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState<NotifyOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setNotification(null);
    });
  }, [opacity]);

  const notify = useCallback(
    (options: NotifyOptions) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setNotification({
        type: "info",
        duration: 3500,
        ...options,
      });
      setVisible(true);

      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      timeoutRef.current = setTimeout(() => {
        hide();
      }, options.duration ?? 3500);
    },
    [hide, opacity]
  );

  const notifySuccess = useCallback(
    (message: string, title = "Sucesso") =>
      notify({ type: "success", title, message }),
    [notify]
  );

  const notifyError = useCallback(
    (message: string, title = "Erro") =>
      notify({ type: "error", title, message }),
    [notify]
  );

  const notifyWarning = useCallback(
    (message: string, title = "Atenção") =>
      notify({ type: "warning", title, message }),
    [notify]
  );

  const notifyInfo = useCallback(
    (message: string, title = "Informação") =>
      notify({ type: "info", title, message }),
    [notify]
  );

  const type = notification?.type ?? "info";
  const colors = getNotificationStyle(type);

  return (
    <NotificationContext.Provider
      value={{
        notify,
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo,
      }}
    >
      {children}

      {visible && notification && (
        <Animated.View
          style={{
            position: "absolute",
            top: Platform.OS === "web" ? 24 : 54,
            left: 16,
            right: 16,
            zIndex: 9999,
            opacity,
            alignItems: "center",
          }}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={hide}
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 14,
              flexDirection: "row",
              alignItems: "flex-start",
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
          >
            <Ionicons
              name={colors.icon}
              size={24}
              color={colors.title}
              style={{ marginRight: 10, marginTop: 1 }}
            />

            <View style={{ flex: 1 }}>
              {!!notification.title && (
                <Text
                  style={{
                    color: colors.title,
                    fontSize: 14,
                    fontWeight: "900",
                    marginBottom: 2,
                  }}
                >
                  {notification.title}
                </Text>
              )}

              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  lineHeight: 19,
                  fontWeight: "600",
                }}
              >
                {notification.message}
              </Text>
            </View>

            <Ionicons name="close-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
}

export default NotificationProvider;