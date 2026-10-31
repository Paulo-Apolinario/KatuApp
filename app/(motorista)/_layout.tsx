import {useEffect} from "react";
import {router} from "expo-router";
import {FieldButton} from "@/src/components/cooperative/FieldUI";
import {restoreSharing} from "@/src/services/driverTracking";
import { View } from "react-native";
import { SyncSummary } from "@/src/components/SyncSummary";
import ProtectedRoute from "@/src/components/ProtectedRoute";
import { Stack } from "expo-router";

export default function MotoristaLayout() {
  useEffect(()=>{void restoreSharing().catch(()=>{});},[]);
  return (
    <ProtectedRoute allowedUserTypes={["DRIVER"]}>
      <View style={{ flex: 1 }}><SyncSummary /><View style={{paddingHorizontal:12,paddingVertical:4}}><FieldButton secondary label="Localização para a cooperativa" onPress={()=>router.push("/(motorista)/compartilhar-localizacao" as any)}/></View>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="mapa" />
        <Stack.Screen name="rotas" />
        <Stack.Screen name="calendario" />
        <Stack.Screen name="veiculos" />
        <Stack.Screen name="relatorios" />
        <Stack.Screen name="historico-relatorios" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="edit-profile" />
      </Stack></View>
    </ProtectedRoute>
  );
}
