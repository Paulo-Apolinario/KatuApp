import { router } from "expo-router";
import { TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface LogoutButtonProps {
  color?: string;
  size?: number;
}

export default function LogoutButton({ color = "#FFFFFF", size = 24 }: LogoutButtonProps) {
  const handleLogout = () => {
    Alert.alert(
      "Sair da conta",
      "Tem certeza que deseja sair?",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Sair",
          onPress: () => {
            // Redirecionar para a tela de seleção de perfil
            router.replace("/(public)/access-type");
          },
          style: "destructive"
        }
      ]
    );
  };

  return (
    <TouchableOpacity onPress={handleLogout}>
      <Ionicons name="log-out-outline" size={size} color={color} />
    </TouchableOpacity>
  );
}