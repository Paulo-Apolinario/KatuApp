import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNotification } from "@/src/contexts/NotificationContext";

import {
  collectorService,
  type Collector,
} from "@/src/services/collectorService";

export default function CatadoresScreen() {
  const [searchText, setSearchText] = useState("");
  const [catadores, setCatadores] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const { notifyError } = useNotification();


  const carregarCatadores = useCallback(async () => {
    try {
      setLoading(true);
      const data = await collectorService.list();
      setCatadores(data);
    } catch (error) {
      console.error("Erro ao carregar catadores:", error);
      notifyError("Não foi possível carregar os catadores.");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useFocusEffect(
    useCallback(() => {
      carregarCatadores();
    }, [carregarCatadores])
  );

  const getStatusColor = (status: Collector["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "#10B981";
      case "ON_ROUTE":
        return "#F59E0B";
      case "INACTIVE":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status: Collector["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "DISPONÍVEL";
      case "ON_ROUTE":
        return "EM COLETA";
      case "INACTIVE":
        return "INATIVO";
      default:
        return status;
    }
  };

  const filteredCatadores = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    if (!term) return catadores;

    return catadores.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.phone || "").includes(searchText)
    );
  }, [catadores, searchText]);

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.replace("/(cooperativa)/home")}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 36, height: 36, marginRight: 8 }}
            />
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>
              KATUÁ
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/(cooperativa)/catadores/novo")}>
            <Ionicons name="person-add-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 15,
          }}
        >
          CATADORES
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 5,
          }}
        >
          {filteredCatadores.length} catadores cadastrados
        </Text>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <View style={{ padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F9FAFB",
              borderRadius: 12,
              paddingHorizontal: 15,
              paddingVertical: Platform.OS === "ios" ? 12 : 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Buscar por nome, email ou telefone"
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                marginLeft: 10,
                fontSize: 16,
                color: "#111827",
              }}
            />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ paddingHorizontal: 20 }}
        >
          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#028C56" />
              <Text style={{ marginTop: 10, color: "#6B7280" }}>
                Carregando catadores...
              </Text>
            </View>
          ) : filteredCatadores.length > 0 ? (
            filteredCatadores.map((catador) => (
              <TouchableOpacity
                key={catador.id}
                onPress={() => router.push(`/(cooperativa)/catadores/${catador.id}` as any)}
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: "#E5E7EB",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="person" size={30} color="#9CA3AF" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                        {catador.name}
                      </Text>

                      <View
                        style={{
                          backgroundColor: getStatusColor(catador.status),
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "600" }}>
                          {getStatusText(catador.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", marginTop: 4, flexWrap: "wrap" }}>
                      <Ionicons name="call-outline" size={12} color="#6B7280" />
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#6B7280",
                          marginLeft: 4,
                          marginRight: 10,
                        }}
                      >
                        {catador.phone || "-"}
                      </Text>

                      <Ionicons name="mail-outline" size={12} color="#6B7280" />
                      <Text style={{ fontSize: 11, color: "#6B7280", marginLeft: 4 }}>
                        {catador.email}
                      </Text>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        marginTop: 8,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: "#E5E7EB",
                      }}
                    >
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#028C56" }}>
                          {Number(catador.kgMonth || 0)} kg
                        </Text>
                        <Text style={{ fontSize: 10, color: "#6B7280" }}>NO MÊS</Text>
                      </View>

                      <View style={{ width: 1, backgroundColor: "#E5E7EB" }} />

                      <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#028C56" }}>
                          {Number(catador.collectionsToday || 0)}
                        </Text>
                        <Text style={{ fontSize: 10, color: "#6B7280" }}>COLETAS HOJE</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text
              style={{
                fontSize: 16,
                color: "#6B7280",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              Nenhum catador encontrado
            </Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}