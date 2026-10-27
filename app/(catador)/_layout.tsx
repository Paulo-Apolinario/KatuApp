import { useBottomTabOptions } from "@/src/hooks/useBottomTabOptions";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function CatadorLayout() {
  const bottomTabOptions = useBottomTabOptions();
  return (
    <ProtectedRoute allowedUserTypes={["COLLECTOR"]}>
      <Tabs screenOptions={{ ...bottomTabOptions, headerShown: false }}>
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
            tabBarLabel: "Recibos",

            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "document-text" : "document-text-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="roteiro"
          options={{ href: null, title: "Minhas rotas" }}
        />
        <Tabs.Screen
          name="extra-orders"
          options={{ href: null, title: "Ordens de coleta extras" }}
        />
        <Tabs.Screen
          name="profile"
          options={{ href: null, title: "Minha conta" }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="producao-equipe" options={{ href: null, title: "Minha produção em equipe" }} />
        <Tabs.Screen name="pev-atendimento" options={{href:null,title:"Solicitações de PEV"}} />
      </Tabs>
    </ProtectedRoute>
  );
}
