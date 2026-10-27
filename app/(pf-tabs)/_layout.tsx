import { useBottomTabOptions } from "@/src/hooks/useBottomTabOptions";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import LogoutButton from "@/src/components/LogoutButton.tsx";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function PFLayout() {
  const bottomTabOptions = useBottomTabOptions();
  return (
    <ProtectedRoute allowedUserTypes={["PF"]}>
      <Tabs
        screenOptions={{
          ...bottomTabOptions,
          headerShown: true,
          headerStyle: {
            backgroundColor: "#047857",
          },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "600",
          },
          headerRight: () => (
            <View style={{ flexDirection: "row", marginRight: 15 }}>
              <LogoutButton color="#FFFFFF" size={24} />
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Início",
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="schedule"
          options={{
            title: "Agendar",
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: "Histórico",
            tabBarIcon: ({ color }) => (
              <Ionicons name="time-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="ranking"
          options={{
            title: "Participação",
            tabBarIcon: ({ color }) => (
              <Ionicons name="trophy-outline" size={24} color={color} />
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

        <Tabs.Screen
          name="edit-profile"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="calculator"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="nfc"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="store"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="chat"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen name="pevs-publicos" options={{href:null,title:"Solicitações de PEV"}} />
      </Tabs>
    </ProtectedRoute>
  );
}
