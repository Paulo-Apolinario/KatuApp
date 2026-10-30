import { ReactNode } from "react";
import { router } from "expo-router";
import { ScrollView, View, Text, Pressable } from "react-native";
import { NotificationBell } from "../NotificationBell";
import { Action, Notice } from "../ui/Workspace";
export function ResidentialPage({ title, subtitle, children, back = false }: { title: string; subtitle?: string; children: ReactNode; back?: boolean }) {
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: "#F4F8F6" }} contentContainerStyle={{ paddingBottom: 32 }}>
    <View style={{ backgroundColor: "#123C35", padding: 20, gap: 10 }}>
      {back && <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/(pf-tabs)/residential-home")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: "white" }}>← Voltar</Text></Pressable>}
      <Text style={{ color: "#BDE6D6", fontSize: 12, fontWeight: "700" }}>KATUÁ · GERADOR RESIDENCIAL</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text accessibilityRole="header" style={{ flex: 1, color: "white", fontSize: 26, fontWeight: "700" }}>{title}</Text><NotificationBell /></View>
      {!!subtitle && <Text style={{ color: "#D8EFE5", lineHeight: 21 }}>{subtitle}</Text>}
    </View>
    <View style={{ width: "100%", maxWidth: 920, alignSelf: "center", padding: 16, gap: 4 }}>{children}</View>
  </ScrollView>;
}
export function ResidentialLoad({ busy, error, cached, retry }: { busy: boolean; error: string; cached: boolean; retry: () => void }) {
  return <>{busy && <Notice text="Atualizando informações…" />}{!!error && <><Notice error text={cached ? "Exibindo informações salvas. Não foi possível confirmar uma atualização." : error} /><Action secondary label="Tentar atualizar" onPress={retry} busy={busy} /></>}</>;
}
export function Metric({ value, label }: { value: string; label: string }) {
  return <View style={{ flexGrow: 1, minWidth: 125, padding: 16, backgroundColor: "#E8F4ED", borderRadius: 12, gap: 6 }}><Text style={{ fontSize: 25, fontWeight: "700", color: "#17694F" }}>{value}</Text><Text style={{ color: "#334155" }}>{label}</Text></View>;
}
