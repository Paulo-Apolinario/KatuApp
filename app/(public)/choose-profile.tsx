import { router } from "expo-router";
import {
  AccessShell,
  AccessLink,
  ProfileChoice,
} from "@/src/components/auth/AccessShell";
export default function ChooseProfile() {
  return (
    <AccessShell
      eyebrow="PERFIL DO GERADOR"
      title="Qual é o seu perfil?"
      subtitle="Escolha a opção que corresponde ao seu cadastro. A localização será solicitada quando necessária para a coleta."
      onBack={() => router.replace("/(public)/access-type")}
    >
      <ProfileChoice
        title="Gerador residencial"
        description="Coletas de materiais recicláveis da sua residência."
        icon="person-outline"
        onPress={() => router.push("/(auth)/login?profile=pf")}
      />
      <ProfileChoice
        title="Pequeno gerador comercial"
        description="Estabelecimentos e pequenos negócios."
        icon="storefront-outline"
        onPress={() => router.push("/(auth)/login?profile=comercial")}
      />
      <ProfileChoice
        title="Grande gerador"
        description="Empresas e operações de maior porte."
        icon="business-outline"
        onPress={() => router.push("/(auth)/login?profile=grande")}
      />
      <AccessLink
        label="Fui cadastrado pela cooperativa: liberar acesso"
        onPress={() => router.push("/(public)/activate-access")}
      />
    </AccessShell>
  );
}
