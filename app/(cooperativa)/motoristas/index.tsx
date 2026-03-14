import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  status: "disponivel" | "em_rota" | "indisponivel";
}

export default function MotoristasScreen() {
  const { user } = useAuth();

  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);

  const carregarMotoristas = useCallback(async () => {
    if (!user?.uid) {
      setMotoristas([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const q = query(
        collection(db, "motoristas"),
        where("cooperativaId", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);

      const lista: Motorista[] = querySnapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Motorista, "id">),
      }));

      setMotoristas(lista);
    } catch (error) {
      console.error("Erro ao carregar motoristas:", error);
      Alert.alert("Erro", "Não foi possível carregar os motoristas.");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      carregarMotoristas();
    }, [carregarMotoristas])
  );

  const handleExcluir = (motorista: Motorista) => {
    Alert.alert(
      "Confirmar exclusão",
      `Deseja realmente excluir ${motorista.nome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "motoristas", motorista.id));
              setMotoristas((prev) => prev.filter((m) => m.id !== motorista.id));
              Alert.alert("Sucesso", "Motorista excluído com sucesso!");
            } catch (error) {
              console.error("Erro ao excluir motorista:", error);
              Alert.alert("Erro", "Não foi possível excluir o motorista.");
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "disponivel":
        return "#10B981";
      case "em_rota":
        return "#F59E0B";
      case "indisponivel":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "disponivel":
        return "DISPONÍVEL";
      case "em_rota":
        return "EM ROTA";
      case "indisponivel":
        return "INDISPONÍVEL";
      default:
        return status.toUpperCase();
    }
  };

  function formatCpf(cpf: string) {
    const only = (cpf || "").replace(/\D/g, "");
    if (only.length !== 11) return cpf || "";
    return only.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  const filteredMotoristas = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    if (!term) return motoristas;

    return motoristas.filter(
      (m) =>
        m.nome.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        (m.cpf || "").includes(searchText.replace(/\D/g, ""))
    );
  }, [motoristas, searchText]);

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
              KATU
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(cooperativa)/motoristas/novo")}
          >
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
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
          MOTORISTAS
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 5,
          }}
        >
          {filteredMotoristas.length} motoristas cadastrados
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
              placeholder="Buscar por nome, email ou CPF"
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
                Carregando motoristas...
              </Text>
            </View>
          ) : (
            filteredMotoristas.map((motorista) => (
              <View
                key={motorista.id}
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <Ionicons name="person" size={20} color="#028C56" />
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#111827",
                          marginLeft: 8,
                        }}
                      >
                        {motorista.nome}
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#6B7280",
                        marginLeft: 28,
                      }}
                    >
                      CPF: {formatCpf(motorista.cpf)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#6B7280",
                        marginLeft: 28,
                      }}
                    >
                      {motorista.telefone} • {motorista.email}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <View
                      style={{
                        backgroundColor: getStatusColor(motorista.status),
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12,
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 10,
                          fontWeight: "600",
                        }}
                      >
                        {getStatusText(motorista.status)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row" }}>
                      <TouchableOpacity
                        onPress={() =>
                          router.push(
                            `/(cooperativa)/motoristas/editar/${motorista.id}` as any
                          )
                        }
                        style={{ marginRight: 15 }}
                      >
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color="#028C56"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => handleExcluir(motorista)}>
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color="#DC2626"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}

          {!loading && filteredMotoristas.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
              <Text
                style={{
                  fontSize: 16,
                  color: "#6B7280",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                Nenhum motorista cadastrado{"\n"}
                Clique no + para adicionar
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}