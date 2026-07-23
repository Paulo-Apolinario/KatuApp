import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function CatadorLayout() {
  return (
    <ProtectedRoute allowedUserTypes={["COLLECTOR"]}>
      <Tabs
        screenOptions={{
          headerShown: false,

          tabBarActiveTintColor: "#028C56",
          tabBarInactiveTintColor: "#94A3B8",

          tabBarHideOnKeyboard: true,

          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            marginTop: 2,
          },

          tabBarIconStyle: {
            marginTop: 2,
          },

          tabBarItemStyle: {
            paddingVertical: 4,
          },

          tabBarStyle: {
            height: 72,
            paddingTop: 6,
            paddingBottom: 8,

            backgroundColor: "#FFFFFF",

            borderTopWidth: 1,
            borderTopColor: "#E5E7EB",

            elevation: 10,

            shadowColor: "#000000",
            shadowOffset: {
              width: 0,
              height: -2,
            },
            shadowOpacity: 0.08,
            shadowRadius: 6,
          },
        }}
      >
        <Tabs.Screen
          name="homecat"
          options={{
            title: "Início",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="collect"
          options={{
            title: "Coletar",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "trash" : "trash-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="mapas"
          options={{
            title: "Mapa",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "map" : "map-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="data"
          options={{
            title: "Dados",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "stats-chart" : "stats-chart-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="receipts"
          options={{
            title: "Comprovantes",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={
                  focused
                    ? "document-text"
                    : "document-text-outline"
                }
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="dashboard"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}