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
import { generatorService, Generator } from "@/src/services/generatorService";
import { useNotification } from "@/src/contexts/NotificationContext";

type GeradorStatus = "ativo" | "pendente" | "inativo";

interface GrandeGerador {
  id: string;
  nome: string;
  endereco: string;
  contato: string;
  telefone: string;
  ultimaColeta: string;
  kgColetado: number;
  status: GeradorStatus;
  tipo: "pequeno" | "grande";
}

function mapAccessStatusToGeradorStatus(status?: string | null): GeradorStatus {
  if (status === "ACTIVE") return "ativo";
  if (status === "PENDING") return "pendente";
  return "inativo";
}

function mapGeneratorToGrande(item: Generator): GrandeGerador {
  return {
    id: item.id,
    nome: item.companyName || "Sem nome",
    endereco: item.address || "Endereço não informado",
    contato: item.name || "Não informado",
    telefone: item.phone || "Não informado",
    ultimaColeta: "Sem registro",
    kgColetado: Number(item.totalKg ?? 0),
    status: mapAccessStatusToGeradorStatus(item.accessStatus),
    tipo: "grande",
  };
}

export default function GrandeGeradorScreen() {
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState<GeradorStatus | "todos">("todos");
  const [loading, setLoading] = useState(true);
  const [geradores, setGeradores] = useState<GrandeGerador[]>([]);
  const { notifyError } = useNotification();

  const carregarGeradores = useCallback(async () => {
    try {
      setLoading(true);

      const response = await generatorService.list();

      const lista: GrandeGerador[] = response
        .filter((item) => item.type === "LARGE")
        .map(mapGeneratorToGrande);

      setGeradores(lista);
    } catch (error: any) {
      notifyError("Erro", error.message || "Não foi possível carregar os grandes geradores.");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useFocusEffect(
    useCallback(() => {
      carregarGeradores();
    }, [carregarGeradores])
  );

  const filteredGeradores = useMemo(() => {
    return geradores.filter((g) => {
      const matchesSearch =
        g.nome.toLowerCase().includes(searchText.toLowerCase()) ||
        g.endereco.toLowerCase().includes(searchText.toLowerCase()) ||
        g.contato.toLowerCase().includes(searchText.toLowerCase());

      const matchesFilter = filterStatus === "todos" || g.status === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [geradores, searchText, filterStatus]);

  const totalKg = filteredGeradores.reduce((sum, g) => sum + g.kgColetado, 0);
  const ativos = filteredGeradores.filter((g) => g.status === "ativo").length;

  const getStatusColor = (status: GeradorStatus) => {
    switch (status) {
      case "ativo":
        return "#10B981";
      case "pendente":
        return "#F59E0B";
      case "inativo":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

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
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <TouchableOpacity onPress={() => router.back()}>
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

          <TouchableOpacity onPress={() => router.push("/(cooperativa)/geradores/novo-grande")}>
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 24, fontWeight: "700", color: "#FFFFFF", marginTop: 15 }}>
          GRANDE GERADOR
        </Text>
        <Text style={{ fontSize: 14, color: "#FFFFFF", opacity: 0.9, marginTop: 5 }}>
          {filteredGeradores.length} empresas cadastradas
        </Text>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", padding: 20, paddingBottom: 10 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#F0FDF4",
              borderRadius: 12,
              padding: 15,
              marginRight: 10,
            }}
          >
            <Text style={{ fontSize: 12, color: "#4B5563" }}>Total Coletado</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#028C56" }}>
              {totalKg} kg
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#EFF6FF",
              borderRadius: 12,
              padding: 15,
              marginLeft: 10,
            }}
          >
            <Text style={{ fontSize: 12, color: "#4B5563" }}>Ativos</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#2563EB" }}>
              {ativos}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 15 }}>
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
              marginBottom: 15,
            }}
          >
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Buscar empresa, endereço ou contato"
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                marginLeft: 10,
                fontSize: 16,
                color: "#111827",
              }}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { label: "TODOS", value: "todos", color: "#028C56" },
              { label: "ATIVOS", value: "ativo", color: "#10B981" },
              { label: "PENDENTES", value: "pendente", color: "#F59E0B" },
              { label: "INATIVOS", value: "inativo", color: "#6B7280" },
            ].map((item) => {
              const selected = filterStatus === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setFilterStatus(item.value as GeradorStatus | "todos")}
                  style={{
                    backgroundColor: selected ? item.color : "#F3F4F6",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 8,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : "#4B5563",
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 20 }}>
          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#028C56" />
              <Text style={{ marginTop: 10, color: "#6B7280" }}>
                Carregando geradores...
              </Text>
            </View>
          ) : filteredGeradores.length > 0 ? (
            filteredGeradores.map((gerador) => (
              <TouchableOpacity
                key={gerador.id}
                onPress={() => router.push(`/(cooperativa)/geradores/${gerador.id}`)}
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 }}>
                    {gerador.nome}
                  </Text>

                  <View
                    style={{
                      backgroundColor: getStatusColor(gerador.status),
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                      marginLeft: 10,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "600" }}>
                      {gerador.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Ionicons name="location-outline" size={14} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#6B7280", marginLeft: 4, flex: 1 }}>
                      {gerador.endereco}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Ionicons name="person-outline" size={14} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#6B7280", marginLeft: 4 }}>
                      {gerador.contato}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="call-outline" size={14} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#6B7280", marginLeft: 4 }}>
                      {gerador.telefone}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: "#E5E7EB",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={{ fontSize: 12, color: "#6B7280", marginLeft: 4 }}>
                      Última: {gerador.ultimaColeta}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="trash-outline" size={14} color="#028C56" />
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#028C56",
                        fontWeight: "700",
                        marginLeft: 4,
                      }}
                    >
                      {gerador.kgColetado} kg
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Ionicons name="business-outline" size={48} color="#9CA3AF" />
              <Text style={{ fontSize: 16, color: "#6B7280", marginTop: 10, textAlign: "center" }}>
                Nenhum grande gerador cadastrado
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}