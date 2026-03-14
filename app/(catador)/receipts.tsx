import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";

import { generateReceiptPDF } from "../../src/services/pdfGenerator";
import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type ReceiptItem = {
  id: string;
  date: string;
  kg: number;
  materials: string[];
  local: string;
};

export default function ReceiptsScreen() {
  const { user } = useAuth();

  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReceipt, setLoadingReceipt] = useState<string | null>(null);

  const [userData, setUserData] = useState<any>(null);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [userSnap, coletasSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(query(collection(db, "coletas"), where("catadorId", "==", user.uid))),
      ]);

      const userDocData: any = userSnap.exists() ? userSnap.data() : {};

      setUserData({
        name: userDocData.displayName || user.displayName || "",
        age: userDocData.age || "",
        location: userDocData.address || "",
        cpf: userDocData.cpf || "",
        phone: userDocData.phone || "",
        totalKg: Number(userDocData.totalKg || 0),
        since: userDocData.createdAt?.toDate
          ? userDocData.createdAt.toDate().toLocaleDateString("pt-BR")
          : "-",
        code: userDocData.code || user.uid,
        topMaterials: [],
      });

      const lista: ReceiptItem[] = coletasSnap.docs.map((docSnap) => {
        const data: any = docSnap.data();

        let formattedDate = "-";
        if (data.createdAt?.toDate) {
          formattedDate = data.createdAt.toDate().toLocaleDateString("pt-BR");
        }

        return {
          id: docSnap.id,
          date: formattedDate,
          kg: Number(data.pesoKg || 0),
          materials: Array.isArray(data.materiais) ? data.materiais : [],
          local: data.local || "-",
        };
      });

      setReceipts(lista);
    } catch (error) {
      console.error("Erro ao carregar comprovantes:", error);
      Alert.alert("Erro", "Não foi possível carregar os comprovantes.");
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.displayName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const receiptsOrdenados = useMemo(() => {
    return [...receipts].reverse();
  }, [receipts]);

  const handleGenerateFullReceipt = async () => {
    if (!userData) {
      Alert.alert("Erro", "Dados do usuário não carregados.");
      return;
    }

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

  const handleGenerateReceipt = async (receipt: ReceiptItem) => {
    if (!userData) {
      Alert.alert("Erro", "Dados do usuário não carregados.");
      return;
    }

    setLoadingReceipt(receipt.id);

    try {
      const result = await generateReceiptPDF(userData, receipt);

      if (result.success) {
        Alert.alert(
          "Sucesso",
          `Comprovante da coleta de ${receipt.date} gerado com sucesso!`
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
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="document-text" size={24} color="#028C56" />
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "#028C56", marginLeft: 10 }}>
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
                          {receipt.date}
                        </Text>
                        <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>
                          {receipt.materials.join(", ")}
                        </Text>
                        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                          {receipt.local}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#028C56" }}>
                          {receipt.kg}kg
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
                        • Peso: {receipt.kg}kg
                      </Text>
                      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 5 }}>
                        • Materiais: {receipt.materials.join(", ")}
                      </Text>
                      <Text style={{ fontSize: 14, color: "#111827", marginBottom: 5 }}>
                        • Local: {receipt.local}
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
                  Nenhuma coleta registrada ainda.
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