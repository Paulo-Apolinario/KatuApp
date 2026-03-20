import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { generateReceiptPDF } from "@/src/services/pdfGenerator";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

type AuthUser = {
  id?: string;
  uid?: string;
  displayName?: string;
  name?: string;
  email?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("pt-BR");
}

export default function ReceiptsScreen() {
  const { user } = useAuth();
  const currentUser = user as AuthUser | null;

  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReceipt, setLoadingReceipt] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Collection[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);

      const response = await collectionService.list();

      const completed = response.filter((item) => item.status === "COMPLETED");
      setReceipts(completed);
    } catch (error) {
      console.error("Erro ao carregar comprovantes:", error);
      Alert.alert("Erro", "Não foi possível carregar os comprovantes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const receiptsOrdenados = useMemo(() => {
    return [...receipts].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [receipts]);

  const userData = useMemo(() => {
  return {
    name: currentUser?.displayName || currentUser?.name || "Catador",
    age: 0,                      // ← coloque 0 ou pegue de algum lugar real (perfil?)
    location: "Fortaleza",       // ← ou deixe vazio / pegue do contexto
    cpf: "",                     // ← idealmente vir do perfil do usuário
    phone: "",
    email: currentUser?.email || "",
    code: currentUser?.id || currentUser?.uid || "",
    totalKg: receiptsOrdenados.reduce(
      (acc, item) => acc + Number(item.totalWeightKg || 0),
      0
    ),
    since:
      receiptsOrdenados.length > 0
        ? formatDate(receiptsOrdenados[receiptsOrdenados.length - 1]?.createdAt)
        : "-",
    topMaterials: [],            // ← pode calcular os mais frequentes depois
  };
}, [currentUser, receiptsOrdenados]);

  const handleGenerateFullReceipt = async () => {
    setLoadingReceipt("full");

    try {
      const result = await generateReceiptPDF(userData);

      if (result.success) {
        Alert.alert("Sucesso", "Comprovante gerado com sucesso!");
      } else {
        Alert.alert("Erro", "Não foi possível gerar o comprovante.");
      }
    } catch (error) {
      console.error("Erro ao gerar comprovante completo:", error);
      Alert.alert("Erro", "Ocorreu um erro ao gerar o comprovante.");
    } finally {
      setLoadingReceipt(null);
    }
  };

  const handleGenerateReceipt = async (receipt: Collection) => {
    setLoadingReceipt(receipt.id);

    try {
      const result = await generateReceiptPDF(userData, {
        id: receipt.id,
        date: formatDate(receipt.createdAt),
        kg: receipt.totalWeightKg,
        materials: receipt.materials || [],
        local: receipt.notes || "-",
      });

      if (result.success) {
        Alert.alert(
          "Sucesso",
          `Comprovante da coleta de ${formatDate(receipt.createdAt)} gerado com sucesso!`
        );
      } else {
        Alert.alert("Erro", "Não foi possível gerar o comprovante.");
      }
    } catch (error) {
      console.error("Erro ao gerar comprovante da coleta:", error);
      Alert.alert("Erro", "Ocorreu um erro ao gerar o comprovante.");
    } finally {
      setLoadingReceipt(null);
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#FFFFFF" }}>
            COMPROVANTES
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 15 }}>
          <Image
            source={require("../../assets/images/logo.png")}
            resizeMode="contain"
            style={{ width: 30, height: 30, marginRight: 8 }}
          />
          <Text style={{ fontSize: 16, color: "#FFFFFF", opacity: 0.9 }}>
            Documentos oficiais
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 10, color: "#6B7280" }}>
              Carregando comprovantes...
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleGenerateFullReceipt}
              disabled={loadingReceipt === "full"}
              style={{
                backgroundColor: "#F0FDF4",
                borderRadius: 16,
                padding: 20,
                marginBottom: 25,
                borderWidth: 2,
                borderColor: "#028C56",
                opacity: loadingReceipt === "full" ? 0.7 : 1,
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
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="document-text" size={24} color="#028C56" />
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: "#028C56",
                      marginLeft: 10,
                    }}
                  >
                    Comprovante de Serviço
                  </Text>
                </View>

                {loadingReceipt === "full" ? (
                  <ActivityIndicator size="small" color="#028C56" />
                ) : (
                  <Ionicons name="download-outline" size={24} color="#028C56" />
                )}
              </View>

              <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                Gerar comprovante completo com o histórico consolidado
              </Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                Formato: PDF • Atualizado com dados reais
              </Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 15 }}>
              Histórico de Coletas
            </Text>

            {receiptsOrdenados.length > 0 ? (
              receiptsOrdenados.map((receipt) => (
                <View
                  key={receipt.id}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 12,
                    padding: 15,
                    marginBottom: 10,
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedReceipt(selectedReceipt === receipt.id ? null : receipt.id)
                    }
                  >
                    <View
                      style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>
                          {formatDate(receipt.createdAt)}
                        </Text>
                        <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>
                          {(receipt.materials || []).join(", ") || "-"}
                        </Text>
                        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                          {receipt.notes || "-"}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#028C56" }}>
                          {receipt.totalWeightKg}kg
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {selectedReceipt === receipt.id && (
                    <View
                      style={{
                        marginTop: 15,
                        paddingTop: 15,
                        borderTopWidth: 1,
                        borderTopColor: "#E5E7EB",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 10 }}>
                        Detalhes da coleta:
                      </Text>
                      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 5 }}>
                        • Peso: {receipt.totalWeightKg}kg
                      </Text>
                      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 5 }}>
                        • Materiais: {(receipt.materials || []).join(", ") || "-"}
                      </Text>
                      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 5 }}>
                        • Observações: {receipt.notes || "-"}
                      </Text>
                      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 15 }}>
                        • Catador: {userData?.name || "-"}
                      </Text>

                      <TouchableOpacity
                        onPress={() => handleGenerateReceipt(receipt)}
                        disabled={loadingReceipt === receipt.id}
                        style={{
                          backgroundColor: "#028C56",
                          borderRadius: 8,
                          padding: 12,
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "center",
                          opacity: loadingReceipt === receipt.id ? 0.7 : 1,
                        }}
                      >
                        {loadingReceipt === receipt.id ? (
                          <>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 14,
                                fontWeight: "600",
                                marginLeft: 8,
                              }}
                            >
                              GERANDO...
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                            <Text
                              style={{
                                color: "#FFFFFF",
                                fontSize: 14,
                                fontWeight: "600",
                                marginLeft: 8,
                              }}
                            >
                              GERAR COMPROVANTE
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 12,
                  padding: 20,
                  alignItems: "center",
                }}
              >
                <Ionicons name="document-text-outline" size={42} color="#9CA3AF" />
                <Text style={{ color: "#6B7280", marginTop: 10, textAlign: "center" }}>
                  Nenhuma coleta concluída ainda.
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleGenerateFullReceipt}
              disabled={loadingReceipt === "full"}
              style={{
                backgroundColor: "#028C56",
                borderRadius: 8,
                padding: 16,
                alignItems: "center",
                marginTop: 10,
                marginBottom: 30,
                flexDirection: "row",
                justifyContent: "center",
                opacity: loadingReceipt === "full" ? 0.7 : 1,
              }}
            >
              {loadingReceipt === "full" ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600", marginLeft: 8 }}>
                    GERANDO...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600", marginLeft: 8 }}>
                    GERAR COMPROVANTE COMPLETO
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}