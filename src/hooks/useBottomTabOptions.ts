import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Reserva espaço para os itens e para a navegação por gestos, sem sobrepor o conteúdo. */
export function useBottomTabOptions(): BottomTabNavigationOptions {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const bottomPadding = Math.max(8, insets.bottom);
  const textGrowth = Math.ceil(Math.max(0, fontScale - 1) * 16);

  return {
    tabBarActiveTintColor: "#047857",
    tabBarInactiveTintColor: "#94A3B8",
    tabBarHideOnKeyboard: true,
    tabBarLabelPosition: "below-icon",
    tabBarLabelStyle: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
      marginBottom: 0,
    },
    tabBarIconStyle: { marginTop: 0 },
    tabBarItemStyle: { paddingVertical: 0 },
    tabBarStyle: {
      height: 64 + bottomPadding + textGrowth,
      paddingTop: 6,
      paddingBottom: bottomPadding,
      backgroundColor: "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor: "#E5E7EB",
      elevation: 10,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
    },
  };
}
