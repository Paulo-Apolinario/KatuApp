import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type MaterialType =
  | "ALUMÍNIO"
  | "PLÁSTICO"
  | "PAPEL"
  | "VIDRO"
  | "METAL"
  | "OUTRO";

export default function CollectScreen() {
  const { user } = useAuth();

  const [selectedMaterials, setSelectedMaterials] = useState<MaterialType[]>([]);
  const [weight, setWeight] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const materials: MaterialType[] = [
    "ALUMÍNIO",
    "PLÁSTICO",
    "PAPEL",
    "VIDRO",
    "METAL",
    "OUTRO",
  ];

  const metaDiaria = 50;

  const toggleMaterial = (material: MaterialType) => {
    if (selectedMaterials.includes(material)) {
      setSelectedMaterials((prev) => prev.filter((m) => m !== material));
    } else {
      setSelectedMaterials((prev) => [...prev, material]);
    }
  };

  const progressoAtual = useMemo(() => {
    const totalKg = Number(user?.totalKg || 0);
    return Math.min(Math.round((totalKg / metaDiaria) * 100), 100);
  }, [user?.totalKg]);

  const handleRegisterCollect = async () => {
    if (!user?.uid) {
      Alert.alert("Erro", "Catador não autenticado.");
      return;
    }

    if (!weight || selectedMaterials.length === 0 || !location.trim()) {
      Alert.alert(
        "Atenção",
        "Preencha todos os campos e selecione pelo menos um material."
      );
      return;
    }

    const kg = Number(String(weight).replace(",", "."));

    if (Number.isNaN(kg) || kg <= 0) {
      Alert.alert("Atenção", "Informe um peso válido.");
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "coletas"), {
        catadorId: user.uid,
        userId: user.uid,
        nomeCatador: user.displayName || "",
        emailCatador: user.email || "",
        local: location.trim(),
        pesoKg: kg,
        materiais: selectedMaterials,
        status: "concluida",
        createdAt: serverTimestamp(),
      });

      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        totalKg: increment(kg),
        kgMes: increment(kg),
        coletasHoje: increment(1),
        status: "disponivel",
        updatedAt: serverTimestamp(),
      }).catch(async () => {
        await setDoc(
          userRef,
          {
            totalKg: kg,
            kgMes: kg,
            coletasHoje: 1,
            status: "disponivel",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      const catadoresQuery = query(
        collection(db, "catadores"),
        where("uid", "==", user.uid)
      );

      const catadoresSnap = await getDocs(catadoresQuery);

      if (!catadoresSnap.empty) {
        const catadorDoc = catadoresSnap.docs[0];
        await updateDoc(doc(db, "catadores", catadorDoc.id), {
          totalKg: increment(kg),
          kgMes: increment(kg),
          coletasHoje: increment(1),
          status: "disponivel",
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "catadores"), {
          uid: user.uid,
          cooperativaId: null,
          nome: user.displayName || "",
          email: user.email || "",
          telefone: user.phone || "",
          cpf: user.cpf || "",
          endereco: user.address || "",
          totalKg: kg,
          kgMes: kg,
          coletasHoje: 1,
          status: "disponivel",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      Alert.alert(
        "Sucesso!",
        `Coleta de ${kg} kg registrada com sucesso!`,
        [
          {
            text: "OK",
            onPress: () => {
              setWeight("");
              setSelectedMaterials([]);
              setLocation("");
              router.replace("/(catador)/data");
            },
          },
        ]
      );
    } catch (error) {
      console.error("Erro ao registrar coleta:", error);
      Alert.alert("Erro", "Não foi possível registrar a coleta.");
    } finally {
      setSaving(false);
    }
  };

  const handleReportProblem = () => {
    Alert.alert(
      "Relatar Problema",
      "O fluxo de registro de problemas será a próxima etapa do sistema."
    );
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
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 36, height: 36, marginRight: 8 }}
            />
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>
              KATU
            </Text>
          </View>

          <View style={{ width: 24 }} />
        </View>

        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 15 }}
        >
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#FFFFFF" }}>
            Coletar
          </Text>

          <View
            style={{
              backgroundColor: "#10B981",
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
              DISPONÍVEL
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 25 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "#F0FDF4",
              borderRadius: 16,
              padding: 20,
              marginRight: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
              TOTAL ATUAL
            </Text>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#028C56" }}>
              {Number(user?.totalKg || 0)} kg
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#EFF6FF",
              borderRadius: 16,
              padding: 20,
              marginLeft: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
              META DIÁRIA
            </Text>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#2563EB" }}>
              {metaDiaria} kg
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 25 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
            <Text style={{ fontSize: 14, color: "#4B5563" }}>Progresso</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#028C56" }}>
              {progressoAtual}%
            </Text>
          </View>

          <View style={{ height: 8, backgroundColor: "#E5E7EB", borderRadius: 4 }}>
            <View
              style={{
                width: `${progressoAtual}%`,
                height: 8,
                backgroundColor: "#028C56",
                borderRadius: 4,
              }}
            />
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Local da Coleta
          </Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Digite o endereço ou nome do local"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
              backgroundColor: "#F9FAFB",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Peso da Coleta (kg)
          </Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
              backgroundColor: "#F9FAFB",
            }}
          />
        </View>

        <View style={{ marginBottom: 25 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
            Tipos de Materiais
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {materials.map((material) => {
              const selected = selectedMaterials.includes(material);

              return (
                <TouchableOpacity
                  key={material}
                  onPress={() => toggleMaterial(material)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#F3F4F6",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginRight: 8,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: selected ? "#028C56" : "#D1D5DB",
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : "#4B5563",
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {material}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleRegisterCollect}
            disabled={saving}
            style={{ marginBottom: 12 }}
          >
            <LinearGradient
              colors={["#10F35D", "#028C56"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 52,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginLeft: 8 }}>
                    SALVANDO...
                  </Text>
                </View>
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                  REGISTRAR COLETA
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReportProblem}
            style={{
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#DC2626",
            }}
          >
            <Text style={{ color: "#DC2626", fontSize: 16, fontWeight: "600" }}>
              RELATAR PROBLEMA
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}