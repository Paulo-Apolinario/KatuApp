import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { generatorService, Generator } from "@/src/services/generatorService";

type MaterialItem = {
  nome: string;
  kg: number;
};

type GeradorViewModel = {
  id: string;
  nome: string;
  endereco: string;
  contato: string;
  telefone: string;
  email: string;
  tipo: "pequeno" | "grande";
  status: "ativo" | "pendente" | "inativo";
  ultimaColeta: string;
  kgTotal: number;
  kgMes: number;
  coletasRealizadas: number;
  materiais: MaterialItem[];
};

function mapGeneratorToViewModel(generator: Generator): GeradorViewModel {
  return {
    id: generator.id,
    nome: generator.companyName || "Sem nome",
    endereco: generator.address || "Endereço não informado",
    contato: generator.name || "Não informado",
    telefone: generator.phone || "Não informado",
    email: generator.email || "Não informado",
    tipo: generator.type === "SMALL" ? "pequeno" : "grande",
    status:
      generator.accessStatus === "ACTIVE"
        ? "ativo"
        : generator.accessStatus === "PENDING_ACTIVATION"
        ? "pendente"
        : "inativo",
    ultimaColeta: "Sem registro",
    kgTotal: 0,
    kgMes: 0,
    coletasRealizadas: 0,
    materiais: [],
  };
}

export default function GeradorDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const documentId = Array.isArray(id) ? id[0] : id;

  const [loading, setLoading] = useState(true);
  const [agendando, setAgendando] = useState(false);
  const [gerador, setGerador] = useState<GeradorViewModel | null>(null);

  const loadGerador = useCallback(async () => {
    if (!documentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const response = await generatorService.getGeneratorById(documentId);

      if (!response?.generator) {
        Alert.alert("Erro", "Gerador não encontrado.");
        router.back();
        return;
      }

      setGerador(mapGeneratorToViewModel(response.generator));
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message || "Não foi possível carregar os dados do gerador."
      );
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadGerador();
  }, [loadGerador]);

  const handleAgendarColeta = async () => {
    if (!gerador) return;

    try {
      setAgendando(true);

      Alert.alert(
        "Próxima etapa",
        "A criação de agendamentos será integrada no próximo módulo, usando a API de schedules."
      );
    } finally {
      setAgendando(false);
    }
  };

  const handleEnviarMensagem = async () => {
    if (!gerador?.telefone || gerador.telefone === "Não informado") {
      Alert.alert("Aviso", "Este gerador não possui telefone cadastrado.");
      return;
    }

    const numero = String(gerador.telefone).replace(/\D/g, "");
    const numeroComDdi = numero.startsWith("55") ? numero : `55${numero}`;

    const mensagem = encodeURIComponent(
      `Olá, ${
        gerador.contato !== "Não informado" ? gerador.contato : gerador.nome
      }! Somos da cooperativa e estamos entrando em contato sobre a coleta do estabelecimento ${gerador.nome}.`
    );

    const url = `https://wa.me/${numeroComDdi}?text=${mensagem}`;
    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
      return;
    }

    await Linking.openURL(url);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>Carregando...</Text>
      </View>
    );
  }

  if (!gerador) return null;

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
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF", flex: 1 }}>
            Detalhes do Gerador
          </Text>

          <TouchableOpacity onPress={handleEnviarMensagem}>
            <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#111827", flex: 1 }}>
              {gerador.nome}
            </Text>

            <View
              style={{
                backgroundColor:
                  gerador.status === "ativo"
                    ? "#10B981"
                    : gerador.status === "pendente"
                    ? "#F59E0B"
                    : "#6B7280",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                marginLeft: 10,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
                {String(gerador.status).toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="location-outline" size={18} color="#6B7280" />
              <Text style={{ fontSize: 14, color: "#6B7280", marginLeft: 8, flex: 1 }}>
                {gerador.endereco}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="person-outline" size={18} color="#6B7280" />
              <Text style={{ fontSize: 14, color: "#6B7280", marginLeft: 8 }}>
                {gerador.contato}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="call-outline" size={18} color="#6B7280" />
              <Text style={{ fontSize: 14, color: "#6B7280", marginLeft: 8 }}>
                {gerador.telefone}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <Text style={{ fontSize: 14, color: "#6B7280", marginLeft: 8 }}>
                {gerador.email}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: 15,
              marginTop: 10,
            }}
          >
            <Text style={{ fontSize: 14, color: "#028C56", fontWeight: "600", marginBottom: 10 }}>
              Resumo de Coletas
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#028C56" }}>
                  {gerador.kgTotal} kg
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Total</Text>
              </View>

              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#028C56" }}>
                  {gerador.kgMes} kg
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Este mês</Text>
              </View>

              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#028C56" }}>
                  {gerador.coletasRealizadas}
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Coletas</Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 10 }}>
            Última Coleta
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 14, color: "#6B7280" }}>Data</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>
                {gerador.ultimaColeta}
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "right" }}>Peso</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#028C56" }}>
                {gerador.kgMes} kg
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 15 }}>
            Materiais Reciclados
          </Text>

          {gerador.materiais.length > 0 ? (
            gerador.materiais.map((material: MaterialItem, index: number) => {
              const total = gerador.kgTotal || 1;
              const percent = Math.min((material.kg / total) * 100, 100);

              return (
                <View key={`${material.nome}-${index}`} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, color: "#4B5563" }}>{material.nome}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#028C56" }}>
                      {material.kg} kg
                    </Text>
                  </View>

                  <View style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
                    <View
                      style={{
                        width: `${percent}%`,
                        height: 8,
                        backgroundColor:
                          index === 0
                            ? "#10B981"
                            : index === 1
                            ? "#F59E0B"
                            : index === 2
                            ? "#3B82F6"
                            : "#8B5CF6",
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={{ color: "#6B7280" }}>
              Nenhum material registrado para este gerador.
            </Text>
          )}
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 15 }}>
            Histórico de Coletas
          </Text>

          <Text style={{ color: "#6B7280" }}>
            O histórico detalhado deste gerador será integrado na próxima etapa.
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30 }}>
          <TouchableOpacity
            onPress={handleAgendarColeta}
            disabled={agendando}
            style={{
              flex: 1,
              backgroundColor: "#028C56",
              borderRadius: 8,
              padding: 16,
              alignItems: "center",
              marginRight: 10,
              opacity: agendando ? 0.7 : 1,
            }}
          >
            {agendando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600", marginTop: 5 }}>
                  Agendar
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEnviarMensagem}
            style={{
              flex: 1,
              backgroundColor: "#F3F4F6",
              borderRadius: 8,
              padding: 16,
              alignItems: "center",
              marginLeft: 10,
              borderWidth: 1,
              borderColor: "#D1D5DB",
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#4B5563" />
            <Text style={{ color: "#4B5563", fontSize: 14, fontWeight: "600", marginTop: 5 }}>
              Mensagem
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}