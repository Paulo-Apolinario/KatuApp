import { Stack } from "expo-router";
import ProtectedRoute from "@/src/components/ProtectedRoute";

export default function CooperativaLayout() {
  return (
    <ProtectedRoute allowedUserTypes={["COOPERATIVE"]}>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}