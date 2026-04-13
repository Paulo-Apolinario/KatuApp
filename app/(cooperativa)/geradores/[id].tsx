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
import {
  generatorService,
  type Generator,
} from "@/src/services/generatorService";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

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
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

function normalizeMaterials(materials: unknown) {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (typeof item === "string") {
        return { type: item, quantityKg: 0 };
      }

      if (item && typeof item === "object" && "type" in item) {
        return {
          type: String((item as any).type ?? "Não informado"),
          quantityKg: Number((item as any).quantityKg ?? 0),
        };
      }

      return null;
    })
    .filter(Boolean) as { type: string; quantityKg: number }[];
}

function getCollectionTotalKg(collection: Collection) {
  const materialsKg = normalizeMaterials(collection.materials).reduce(
    (sum, item) => sum + Number(item.quantityKg ?? 0),
    0
  );

  if (materialsKg > 0) return materialsKg;
  return Number(collection.totalWeightKg ?? 0);
}

function formatCollectionDate(value?: string | null) {
  if (!value) return "Sem registro";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem registro";

  return parsed.toLocaleDateString("pt-BR");
}

function mapGeneratorToViewModel(
  generator: Generator,
  collections: Collection[]
): GeradorViewModel {
  const materialsMap: Record<string, number> = {};

  collections.forEach((collection) => {
    const materials = normalizeMaterials(collection.materials);

    materials.forEach((material) => {
      const type = material.type.trim() || "Não informado";
      materialsMap[type] = (materialsMap[type] || 0) + Number(material.quantityKg ?? 0);
    });
  });

  const materiais = Object.entries(materialsMap)
    .map(([nome, kg]) => ({ nome, kg }))
    .sort((a, b) => b.kg - a.kg);

  const totalKg = collections.reduce(
    (sum, item) => sum + getCollectionTotalKg(item),
    0
  );

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const collectionsThisMonth = collections.filter((item) => {
    const rawDate = item.collectedAt || item.createdAt;
    if (!rawDate) return false;

    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return false;

    return (
      parsed.getMonth() === currentMonth && parsed.getFullYear() === currentYear
    );
  });

  const kgMes = collectionsThisMonth.reduce(
    (sum, item) => sum + getCollectionTotalKg(item),
    0
  );

  const latestCollection =
    [...collections].sort((a, b) => {
      const aTime = a.collectedAt
        ? new Date(a.collectedAt).getTime()
        : a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;

      const bTime = b.collectedAt
        ? new Date(b.collectedAt).getTime()
        : b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;

      return bTime - aTime;
    })[0] || null;

  return {
    id: generator.id,
    nome: generator.companyName || generator.name || "Sem nome",
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
    ultimaColeta: formatCollectionDate(
      latestCollection?.collectedAt || latestCollection?.createdAt
    ),
    kgTotal: totalKg,
    kgMes,
    coletasRealizadas: collections.length,
    materiais,
    cep: generator.zipCode || "",
    rua: generator.street || "",
    numero: generator.number || "",
    bairro: generator.neighborhood || "",
    cidade: generator.city || "",
    estado: generator.state || "",
  };
}

function formatTipo(tipo: "pequeno" | "grande") {
  return tipo === "pequeno" ? "Pequeno gerador" : "Grande gerador";
}

function formatStatus(status: "ativo" | "pendente" | "inativo") {
  switch (status) {
    case "ativo":
      return "ATIVO";
    case "pendente":
      return "PENDENTE";
    default:
      return "INATIVO";
  }
}

function getStatusColor(status: "ativo" | "pendente" | "inativo") {
  switch (status) {
    case "ativo":
      return "#10B981";
    case "pendente":
      return "#F59E0B";
    default:
      return "#6B7280";
  }
}

export default function GeradorDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const documentId = Array.isArray(id) ? id[0] : id;

  const [loading, setLoading] = useState(true);
  const [agendando, setAgendando] = useState(false);
  const [gerador, setGerador] = useState<GeradorViewModel | null>(null);

  const loadGerador = useCallback(async () => {
    if (!documentId) {
      Alert.alert("Erro", "ID do gerador não informado.");
      router.back();
      return;
    }

    try {
      setLoading(true);

      if (!generatorService || typeof generatorService.getGeneratorById !== "function") {
        throw new Error("Serviço de geradores não carregado.");
      }

      if (!collectionService || typeof collectionService.list !== "function") {
        throw new Error("Serviço de coletas não carregado.");
      }

      const [generator, allCollections] = await Promise.all([
        generatorService.getGeneratorById(documentId),
        collectionService.list(),
      ]);

      if (!generator) {
        Alert.alert("Erro", "Gerador não encontrado.");
        router.back();
        return;
      }

      const safeCollections = Array.isArray(allCollections) ? allCollections : [];

      const generatorCollections = safeCollections.filter(
        (item) => item.generatorId === documentId && item.status === "COMPLETED"
      );

      setGerador(mapGeneratorToViewModel(generator, generatorCollections));
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível carregar os dados do gerador."
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

    try {
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
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o WhatsApp.");
    }
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

  if (!gerador) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
          padding: 24,
        }}
      >
        <Ionicons name="alert-circle-outline" size={44} color="#9CA3AF" />
        <Text
          style={{
            marginTop: 12,
            fontSize: 16,
            fontWeight: "700",
            color: "#111827",
          }}
        >
          Gerador não encontrado
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            backgroundColor: "#028C56",
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#FFFFFF",
              flex: 1,
            }}
          >
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
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 15,
            }}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#111827",
                flex: 1,
              }}
            >
              {gerador.nome}
            </Text>

            <View
              style={{
                backgroundColor: getStatusColor(gerador.status),
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                marginLeft: 10,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
                {formatStatus(gerador.status)}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 13,
              color: "#028C56",
              fontWeight: "700",
              marginBottom: 14,
            }}
          >
            {formatTipo(gerador.tipo)}
          </Text>

          <View style={{ marginBottom: 12 }}>
            <InfoRow icon="location-outline" value={gerador.endereco} />
            <InfoRow icon="person-outline" value={gerador.contato} />
            <InfoRow icon="call-outline" value={gerador.telefone} />
            <InfoRow icon="mail-outline" value={gerador.email} />
          </View>

          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 12,
              padding: 15,
              marginTop: 10,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: "#028C56",
                fontWeight: "600",
                marginBottom: 10,
              }}
            >
              Resumo de Coletas
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              <ResumoItem label="Total" value={`${gerador.kgTotal.toFixed(1)} kg`} />
              <ResumoItem label="Este mês" value={`${gerador.kgMes.toFixed(1)} kg`} />
              <ResumoItem label="Coletas" value={String(gerador.coletasRealizadas)} />
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
            Endereço estruturado
          </Text>

          <AddressRow label="CEP" value={gerador.cep || "Não informado"} />
          <AddressRow label="Rua" value={gerador.rua || "Não informado"} />
          <AddressRow label="Número" value={gerador.numero || "Não informado"} />
          <AddressRow label="Bairro" value={gerador.bairro || "Não informado"} />
          <AddressRow label="Cidade" value={gerador.cidade || "Não informado"} />
          <AddressRow label="Estado" value={gerador.estado || "Não informado"} isLast />
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

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text style={{ fontSize: 14, color: "#6B7280" }}>Data</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>
                {gerador.ultimaColeta}
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "right" }}>Peso</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#028C56" }}>
                {gerador.kgMes.toFixed(1)} kg
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
            gerador.materiais.map((material, index) => {
              const total = gerador.kgTotal || 1;
              const percent = Math.min((material.kg / total) * 100, 100);

              return (
                <View key={`${material.nome}-${index}`} style={{ marginBottom: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: "#4B5563" }}>{material.nome}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#028C56" }}>
                      {material.kg.toFixed(1)} kg
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

          {gerador.coletasRealizadas > 0 ? (
            <Text style={{ color: "#6B7280" }}>
              Este gerador possui {gerador.coletasRealizadas} coleta(s) concluída(s) registradas.
            </Text>
          ) : (
            <Text style={{ color: "#6B7280" }}>
              Nenhuma coleta concluída registrada ainda.
            </Text>
          )}
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
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: "600",
                    marginTop: 5,
                  }}
                >
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
            <Text
              style={{
                color: "#4B5563",
                fontSize: 14,
                fontWeight: "600",
                marginTop: 5,
              }}
            >
              Mensagem
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
      <Ionicons name={icon} size={18} color="#6B7280" />
      <Text style={{ fontSize: 14, color: "#6B7280", marginLeft: 8, flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

function ResumoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#028C56" }}>{value}</Text>
      <Text style={{ fontSize: 12, color: "#6B7280" }}>{label}</Text>
    </View>
  );
}

function AddressRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingBottom: isLast ? 0 : 12,
        marginBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>{value}</Text>
    </View>
  );
}