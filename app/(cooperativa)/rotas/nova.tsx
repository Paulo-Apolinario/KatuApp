import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type RouteStatus = "agendada" | "em_andamento" | "concluida";

interface Driver {
  id: string;
  nome: string;
}

interface Vehicle {
  id: string;
  modelo: string;
  placa: string;
}

export default function NovaRotaScreen() {
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [data, setData] = useState("");
  const [pontos, setPontos] = useState("");
  const [status, setStatus] = useState<RouteStatus>("agendada");

  const [motoristas, setMotoristas] = useState<Driver[]>([]);
  const [veiculos, setVeiculos] = useState<Vehicle[]>([]);
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!user?.uid) {
      setLoadingOptions(false);
      return;
    }

    try {
      setLoadingOptions(true);

      const [motoristasSnap, veiculosSnap] = await Promise.all([
        getDocs(
          query(collection(db, "motoristas"), where("cooperativaId", "==", user.uid))
        ),
        getDocs(
          query(collection(db, "veiculos"), where("cooperativaId", "==", user.uid))
        ),
      ]);

      setMotoristas(
        motoristasSnap.docs.map((docSnap) => ({
          id: docSnap.id,
          nome: (docSnap.data() as any).nome || "Sem nome",
        }))
      );

      setVeiculos(
        veiculosSnap.docs.map((docSnap) => {
          const dataSnap: any = docSnap.data();
          return {
            id: docSnap.id,
            modelo: dataSnap.modelo || "Sem modelo",
            placa: dataSnap.placa || "Sem placa",
          };
        })
      );
    } catch (error) {
      console.error("Erro ao carregar opções da rota:", error);
      Alert.alert("Erro", "Não foi possível carregar motoristas e veículos.");
    } finally {
      setLoadingOptions(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  async function handleSalvar() {
    if (!user?.uid) {
      Alert.alert("Erro", "Cooperativa não identificada.");
      return;
    }

    if (!nome.trim() || !data.trim() || !pontos.trim() || !motoristaId || !veiculoId) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }

    const pontosArray = pontos
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (pontosArray.length === 0) {
      Alert.alert("Atenção", "Informe pelo menos um ponto da rota.");
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "rotas"), {
        nome: nome.trim(),
        data: data.trim(),
        pontos: pontosArray,
        status,
        motoristaId,
        veiculoId,
        cooperativaId: user.uid,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Sucesso", "Rota cadastrada com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/rotas"),
        },
      ]);
    } catch (error) {
      console.error("Erro ao cadastrar rota:", error);
      Alert.alert("Erro", "Não foi possível cadastrar a rota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/rotas")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVA ROTA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Nome da rota *</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Rota Centro Manhã"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Data *</Text>
          <TextInput
            value={data}
            onChangeText={setData}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        {loadingOptions ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator color="#028C56" />
            <Text style={{ marginTop: 8, color: "#6B7280" }}>Carregando opções...</Text>
          </View>
        ) : (
          <>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
                Motorista *
              </Text>

              {motoristas.length === 0 ? (
                <Text style={{ color: "#6B7280" }}>Nenhum motorista cadastrado.</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {motoristas.map((item) => {
                    const selected = motoristaId === item.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setMotoristaId(item.id)}
                        style={{
                          backgroundColor: selected ? "#028C56" : "#F3F4F6",
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 10,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#FFFFFF" : "#4B5563",
                            fontWeight: "600",
                          }}
                        >
                          {item.nome}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
                Veículo *
              </Text>

              {veiculos.length === 0 ? (
                <Text style={{ color: "#6B7280" }}>Nenhum veículo cadastrado.</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {veiculos.map((item) => {
                    const selected = veiculoId === item.id;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setVeiculoId(item.id)}
                        style={{
                          backgroundColor: selected ? "#028C56" : "#F3F4F6",
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 10,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#FFFFFF" : "#4B5563",
                            fontWeight: "600",
                          }}
                        >
                          {item.modelo} - {item.placa}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Pontos da rota *
          </Text>
          <TextInput
            value={pontos}
            onChangeText={setPontos}
            placeholder="Separe por vírgula. Ex: Centro, Mercado, Praia"
            placeholderTextColor="#9CA3AF"
            multiline
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
              minHeight: 100,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>Status</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Agendada", value: "agendada" },
              { label: "Em andamento", value: "em_andamento" },
              { label: "Concluída", value: "concluida" },
            ].map((item) => {
              const selected = status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setStatus(item.value as RouteStatus)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#F3F4F6",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 10,
                    marginBottom: 10,
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
          </View>
        </View>

        <TouchableOpacity onPress={handleSalvar} disabled={saving} activeOpacity={0.9}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: saving ? 0.7 : 1,
              marginBottom: 30,
            }}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginLeft: 10 }}>
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                SALVAR ROTA
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}