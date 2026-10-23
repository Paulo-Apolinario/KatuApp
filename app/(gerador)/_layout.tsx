import { useBottomTabOptions } from "@/src/hooks/useBottomTabOptions";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function GeradorLayout() {
  const bottomTabOptions = useBottomTabOptions();
  return (
    <ProtectedRoute allowedUserTypes={["GENERATOR_SMALL", "GENERATOR_LARGE"]}>
      <Tabs
        initialRouteName="dashboard"
        screenOptions={{ ...bottomTabOptions, headerShown: false }}
      >
        {/*
         * ============================================================
         * ABAS PRINCIPAIS
         * ============================================================
         */}

        <Tabs.Screen
          name="dashboard"
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
          name="schedules"
          options={{
            title: "Solicitações",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "calendar" : "calendar-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="collections"
          options={{
            title: "Coletas",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "car" : "car-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="percentual"
          options={{
            title: "Impacto",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "pie-chart" : "pie-chart-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        {/*
         * ============================================================
         * ROTAS INTERNAS OCULTAS DA BARRA INFERIOR
         * ============================================================
         */}

        <Tabs.Screen
          name="schedule"
          options={{
            href: null,
            title: "Nova solicitação",
          }}
        />

        <Tabs.Screen
          name="schedule-details"
          options={{
            href: null,
            title: "Detalhes da solicitação",
          }}
        />

        <Tabs.Screen
          name="collection-details"
          options={{
            href: null,
            title: "Detalhes da coleta",
          }}
        />

        <Tabs.Screen
          name="feedback"
          options={{
            href: null,
            title: "Feedback",
          }}
        />

        <Tabs.Screen
          name="edit-profile"
          options={{
            href: null,
            title: "Editar perfil",
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}
