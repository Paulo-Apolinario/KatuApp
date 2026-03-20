import { useCallback, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { generatorService, Generator } from "@/src/services/generatorService";

export default function GeradoresScreen() {
  const [generators, setGenerators] = useState<Generator[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadGenerators() {
    try {
      setLoading(true);
      const response = await generatorService.list();
      setGenerators(response);
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message || "Não foi possível carregar os geradores."
      );
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadGenerators();
    }, [])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      <TouchableOpacity
        onPress={() => router.push("/(cooperativa)/geradores/novo-pequeno")}
        className="mb-4 rounded-xl bg-green-600 p-4"
      >
        <Text className="text-center font-bold text-white">Novo gerador</Text>
      </TouchableOpacity>

      <FlatList
        data={generators}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(cooperativa)/geradores/${item.id}`)}
            className="mb-3 rounded-xl border border-slate-200 p-4"
          >
            <Text className="text-base font-bold">{item.companyName}</Text>
            <Text>{item.companyName || "Sem responsável"}</Text>
            <Text>{item.email}</Text>
            <Text>
              {item.type === "SMALL" ? "Pequeno gerador" : "Grande gerador"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text className="text-center text-slate-500">
            Nenhum gerador cadastrado ainda.
          </Text>
        }
      />
    </View>
  );
}