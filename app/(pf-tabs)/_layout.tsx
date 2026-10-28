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
          headerShown: false,
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
          name="residential-home"
          options={{
            title: "Início",
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="residential-request"
          options={{
            title: "Solicitar",
            tabBarIcon: ({ color }) => (
              <Ionicons name="calendar-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="residential-history"
          options={{
            title: "Minhas coletas",
            tabBarLabel: "Coletas",
            tabBarIcon: ({ color }) => (
              <Ionicons name="time-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="residential-participation"
          options={{
            title: "Participação",
            tabBarLabel: "Evolução",
            tabBarIcon: ({ color }) => (
              <Ionicons name="trophy-outline" size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="residential-profile"
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
          name="residential-planner"
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
        <Tabs.Screen name="request-details" options={{href:null,title:"Acompanhar coleta"}} />
        <Tabs.Screen name="residential-pevs" options={{href:null,title:"Solicitações de PEV"}} />
        <Tabs.Screen name="home" options={{ href: null }} />
        <Tabs.Screen name="schedule" options={{ href: null }} />
        <Tabs.Screen name="history" options={{ href: null }} />
        <Tabs.Screen name="ranking" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="calculator" options={{ href: null }} />
        <Tabs.Screen name="pevs-publicos" options={{ href: null }} />
      </Tabs>
    </ProtectedRoute>
  );
}
