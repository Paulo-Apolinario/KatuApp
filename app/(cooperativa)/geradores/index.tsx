import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { generatorService, type Generator } from "@/src/services/generatorService";

export default function GeradoresScreen() {
  const params = useLocalSearchParams<{ type?: string | string[] }>();
  const selectedType = Array.isArray(params.type) ? params.type[0] : params.type;

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
        error?.message || "Não foi possível carregar os geradores."
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

  const filteredGenerators = useMemo(() => {
    if (selectedType === "SMALL") {
      return generators.filter((item) => item.type === "SMALL");
    }

    if (selectedType === "LARGE") {
      return generators.filter((item) => item.type === "LARGE");
    }

    return generators;
  }, [generators, selectedType]);

  const pageTitle =
    selectedType === "SMALL"
      ? "PEQUENOS GERADORES"
      : selectedType === "LARGE"
      ? "GRANDES GERADORES"
      : "GERADORES";

  const pageSubtitle =
    selectedType === "SMALL"
      ? "Lista de pequenos geradores vinculados à cooperativa"
      : selectedType === "LARGE"
      ? "Lista de grandes geradores vinculados à cooperativa"
      : "Lista de geradores vinculados à cooperativa";

  const newGeneratorRoute =
    selectedType === "LARGE"
      ? "/(cooperativa)/geradores/novo-grande"
      : "/(cooperativa)/geradores/novo-pequeno";

  const newGeneratorLabel =
    selectedType === "LARGE" ? "Novo grande gerador" : "Novo pequeno gerador";

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando geradores...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F4F6" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 22,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: "#FFFFFF",
              marginLeft: 14,
            }}
          >
            {pageTitle}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: "#E8FFF1",
            lineHeight: 22,
          }}
        >
          {pageSubtitle}
        </Text>
      </LinearGradient>

      <View style={{ padding: 16, flex: 1 }}>
        <TouchableOpacity
          onPress={() => router.push(newGeneratorRoute as any)}
          activeOpacity={0.88}
          style={{ marginBottom: 16 }}
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 16,
              minHeight: 54,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "800",
                fontSize: 16,
                marginLeft: 8,
              }}
            >
              {newGeneratorLabel.toUpperCase()}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <FlatList
          data={filteredGenerators}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(`/(cooperativa)/geradores/${item.id}` as any)}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "800",
                      color: "#111827",
                    }}
                  >
                    {item.companyName || item.name || "Gerador sem nome"}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: "#4B5563",
                      marginTop: 6,
                    }}
                  >
                    Responsável: {item.name || "Não informado"}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      marginTop: 4,
                    }}
                  >
                    E-mail: {item.email}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      marginTop: 4,
                    }}
                  >
                    Telefone: {item.phone || "Não informado"}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: "#028C56",
                      fontWeight: "700",
                      marginTop: 8,
                    }}
                  >
                    {item.type === "SMALL"
                      ? "Pequeno gerador"
                      : "Grande gerador"}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#9CA3AF"
                />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 24,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <Ionicons name="business-outline" size={42} color="#9CA3AF" />
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#111827",
                  textAlign: "center",
                }}
              >
                Nenhum gerador encontrado
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  color: "#6B7280",
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                Não há geradores cadastrados para este tipo no momento.
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}