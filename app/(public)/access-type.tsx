import { router } from "expo-router";
import {
  AccessShell,
  AccessLink,
  ProfileChoice,
} from "@/src/components/auth/AccessShell";
export default function AccessTypeScreen() {
  return (
    <AccessShell
      eyebrow="BEM-VINDO À KATUÁ"
      title="Como você participa?"
      subtitle="Escolha seu perfil para acessar os serviços e acompanhar suas operações."
    >
      <ProfileChoice
        title="Gerador"
        description="Solicite coletas e acompanhe os materiais."
        icon="leaf-outline"
        onPress={() => router.push("/(public)/choose-profile")}
      />
      <ProfileChoice
        title="Cooperativa / OSC"
        description="Organize equipes, recebimentos e destinações."
        icon="business-outline"
        onPress={() => router.push("/(auth)/login?profile=cooperativa")}
      />
      <ProfileChoice
        title="Catador"
        description="Consulte suas coletas e registre o trabalho de campo."
        icon="people-outline"
        onPress={() => router.push("/(auth)/login?profile=catador")}
      />
      <ProfileChoice
        title="Motorista"
        description="Acesse suas rotas, veículo e pontos de coleta."
        icon="car-outline"
        onPress={() => router.push("/(auth)/login?profile=motorista")}
      />
      <AccessLink
        label="Já tenho cadastro: liberar meu acesso"
        onPress={() => router.push("/(public)/activate-access")}
      />
    </AccessShell>
  );
}
