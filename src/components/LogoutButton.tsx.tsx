import { useAuth } from "../contexts/AuthContext";
import { TouchableOpacity, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LogoutButtonProps {
  color?: string;
  size?: number;
}

export default function LogoutButton({
  color = "#FFFFFF",
  size = 24,
}: LogoutButtonProps) {
  const { signOut } = useAuth();
  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Deseja sair da sua conta?")) void signOut();
      return;
    }
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Sair",
        onPress: () => {
          // Redirecionar para a tela de seleção de perfil
          void signOut();
        },
        style: "destructive",
      },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={handleLogout}
      accessibilityRole="button"
      accessibilityLabel="Sair da conta"
    >
      <Ionicons name="log-out-outline" size={size} color={color} />
    </TouchableOpacity>
  );
}
