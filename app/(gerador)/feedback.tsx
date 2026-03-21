import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type FeedbackCategory =
  | "ATENDIMENTO"
  | "PONTUALIDADE"
  | "COLETA"
  | "APLICATIVO"
  | "COMUNICAÇÃO";

function getNpsLabel(score: number | null) {
  if (score === null) return "Selecione uma nota";
  if (score <= 6) return "Precisamos melhorar";
  if (score <= 8) return "Boa experiência";
  return "Excelente experiência";
}

function getNpsColor(score: number | null) {
  if (score === null) return "#6B7280";
  if (score <= 6) return "#DC2626";
  if (score <= 8) return "#F59E0B";
  return "#10B981";
}

export default function FeedbackScreen() {
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<FeedbackCategory[]>([]);
  const [reason, setReason] = useState("");
  const [improvement, setImprovement] = useState("");
  const [likes, setLikes] = useState("");
  const [continuity, setContinuity] = useState("");
  const [sending, setSending] = useState(false);

  const categories: FeedbackCategory[] = [
    "ATENDIMENTO",
    "PONTUALIDADE",
    "COLETA",
    "APLICATIVO",
    "COMUNICAÇÃO",
  ];

  const canSubmit = useMemo(() => {
    return npsScore !== null;
  }, [npsScore]);

  const toggleCategory = (category: FeedbackCategory) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories((prev) => prev.filter((item) => item !== category));
    } else {
      setSelectedCategories((prev) => [...prev, category]);
    }
  };

  const resetForm = () => {
    setNpsScore(null);
    setSelectedCategories([]);
    setReason("");
    setImprovement("");
    setLikes("");
    setContinuity("");
  };

  const handleSubmit = async () => {
    if (npsScore === null) {
      Alert.alert("Atenção", "Selecione uma nota de 0 a 10.");
      return;
    }

    try {
      setSending(true);

      // Integração real com endpoint de feedback será conectada na próxima etapa,
      // quando confirmarmos o contrato do backend.
      await new Promise((resolve) => setTimeout(resolve, 500));

      Alert.alert(
        "Obrigado!",
        "Seu feedback foi registrado com sucesso. Ele será importante para melhorar a experiência do gerador no KATU.",
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error("Erro ao enviar feedback:", error);
      Alert.alert("Erro", "Não foi possível enviar seu feedback.");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            FEEDBACK
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 10,
          }}
        >
          Conte como foi sua experiência com o serviço e com a operação da coleta.
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Avaliação geral (NPS)
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#4B5563",
              marginBottom: 16,
              lineHeight: 20,
            }}
          >
            De 0 a 10, qual a probabilidade de você recomendar nossa operação de coleta para outra empresa?
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <TouchableOpacity
                key={score}
                onPress={() => setNpsScore(score)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: npsScore === score ? "#028C56" : "#F3F4F6",
                  margin: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: npsScore === score ? "#028C56" : "#D1D5DB",
                }}
              >
                <Text
                  style={{
                    color: npsScore === score ? "#FFFFFF" : "#4B5563",
                    fontWeight: "700",
                  }}
                >
                  {score}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 12, color: "#6B7280" }}>
              Não recomendaria
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>
              Recomendaria
            </Text>
          </View>

          <View
            style={{
              alignSelf: "center",
              backgroundColor: `${getNpsColor(npsScore)}20`,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 18,
            }}
          >
            <Text
              style={{
                color: getNpsColor(npsScore),
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {getNpsLabel(npsScore)}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Áreas relacionadas ao seu feedback
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {categories.map((category) => {
              const selected = selectedCategories.includes(category);

              return (
                <TouchableOpacity
                  key={category}
                  onPress={() => toggleCategory(category)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#FFFFFF",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 22,
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
                      fontSize: 13,
                    }}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FieldCard
          title="Motivo principal da sua nota"
          placeholder="Conte o principal motivo para a nota que você escolheu"
          value={reason}
          onChangeText={setReason}
          minHeight={100}
        />

        <FieldCard
          title="O que podemos melhorar?"
          placeholder="Descreva o que poderia melhorar na sua experiência"
          value={improvement}
          onChangeText={setImprovement}
          minHeight={100}
        />

        <FieldCard
          title="O que você mais gosta no serviço?"
          placeholder="Conte quais pontos positivos mais se destacam"
          value={likes}
          onChangeText={setLikes}
          minHeight={100}
        />

        <FieldCard
          title="Você pretende continuar usando o serviço?"
          placeholder="Descreva sua intenção para os próximos meses"
          value={continuity}
          onChangeText={setContinuity}
          minHeight={80}
        />

        <View
          style={{
            backgroundColor: "#FEFCE8",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#FDE68A",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: "#92400E",
              marginBottom: 6,
            }}
          >
            Observação
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#92400E",
              lineHeight: 20,
            }}
          >
            Esta tela já está pronta para uso no frontend. A persistência real do feedback será conectada quando confirmarmos o endpoint do backend.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSubmit}
          disabled={sending || !canSubmit}
          style={{ marginBottom: 30 }}
        >
          <LinearGradient
            colors={
              sending || !canSubmit
                ? ["#9CA3AF", "#6B7280"]
                : ["#10F35D", "#028C56"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 54,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
            }}
          >
            <Ionicons
              name={sending ? "time-outline" : "paper-plane-outline"}
              size={20}
              color="#FFFFFF"
            />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 17,
                fontWeight: "800",
                marginLeft: 8,
              }}
            >
              {sending ? "ENVIANDO..." : "ENVIAR FEEDBACK"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldCard({
  title,
  placeholder,
  value,
  onChangeText,
  minHeight,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  minHeight: number;
}) {
  return (
    <View
      style={{
        backgroundColor: "#F9FAFB",
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: "#111827",
          marginBottom: 10,
        }}
      >
        {title}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={{
          borderWidth: 1,
          borderColor: "#D1D5DB",
          borderRadius: 12,
          padding: 14,
          fontSize: 15,
          color: "#111827",
          backgroundColor: "#FFFFFF",
          minHeight,
        }}
      />
    </View>
  );
}