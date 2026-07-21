import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function GeradorLayout() {
  return (
    <ProtectedRoute
      allowedUserTypes={[
        "GENERATOR_SMALL",
        "GENERATOR_LARGE",
      ]}
    >
      <Tabs
        initialRouteName="dashboard"
        screenOptions={{
          headerShown: false,

          tabBarActiveTintColor: "#028C56",
          tabBarInactiveTintColor: "#9CA3AF",

          tabBarHideOnKeyboard: true,

          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            marginBottom: 3,
          },

          tabBarIconStyle: {
            marginTop: 3,
          },

          tabBarStyle: {
            height: 66,
            paddingTop: 6,
            paddingBottom: 7,

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
            shadowRadius: 8,
          },
        }}
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

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "home"
                    : "home-outline"
                }
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

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "calendar"
                    : "calendar-outline"
                }
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

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "car"
                    : "car-outline"
                }
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

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "pie-chart"
                    : "pie-chart-outline"
                }
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

            tabBarIcon: ({
              color,
              focused,
            }) => (
              <Ionicons
                name={
                  focused
                    ? "person"
                    : "person-outline"
                }
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