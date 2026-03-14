import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import LogoutButton from "@/src/components/LogoutButton.tsx";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function CatadorLayout() {
  return (
    <ProtectedRoute allowedUserTypes={["catador"]}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#028C56",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#E5E7EB",
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          headerShown: true,
          headerStyle: {
            backgroundColor: "#028C56",
          },
          headerTintColor: "#FFFFFF",
          headerRight: () => (
            <View style={{ flexDirection: "row", marginRight: 15 }}>
              <LogoutButton color="#FFFFFF" size={24} />
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="homecat"
          options={{
            title: "Início",
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="collect"
          options={{
            title: "Coletar",
            tabBarIcon: ({ color }) => (
              <Ionicons name="trash-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="data"
          options={{
            title: "Dados",
            tabBarIcon: ({ color }) => (
              <Ionicons name="bar-chart-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="receipts"
          options={{
            title: "Comprovantes",
            tabBarIcon: ({ color }) => (
              <Ionicons name="document-text-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-outline" size={24} color={color} />
            ),
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}