import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function FeedbackScreen() {
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [improvement, setImprovement] = useState("");
  const [likes, setLikes] = useState("");
  const [intention, setIntention] = useState("");

  const handleSubmit = () => {
    if (!npsScore) {
      Alert.alert("Atenção", "Selecione uma nota de 0 a 10");
      return;
    }

    Alert.alert(
      "Obrigado!",
      "Seu feedback foi enviado com sucesso!",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Header */}
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            FEEDBACK
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {/* Pergunta NPS */}
        <View style={{ marginBottom: 25 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 15 }}>
            De 0 a 10, qual a probabilidade de você recomendar nossa empresa a um amigo ou colega?
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
            {[0,1,2,3,4,5,6,7,8,9,10].map((score) => (
              <TouchableOpacity
                key={score}
                onPress={() => setNpsScore(score)}
                style={{
                  width: 35,
                  height: 35,
                  borderRadius: 17.5,
                  backgroundColor: npsScore === score ? "#028C56" : "#F3F4F6",
                  margin: 4,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{
                  color: npsScore === score ? "#FFFFFF" : "#4B5563",
                  fontWeight: "600",
                }}>
                  {score}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Não recomendaria</Text>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Recomendaria</Text>
          </View>
        </View>

        {/* Motivo */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Qual foi o principal motivo para a nota que você deu?
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Digite aqui"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 15,
              color: "#111827",
              textAlignVertical: "top",
              minHeight: 80,
            }}
          />
        </View>

        {/* Melhorias */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            O que poderíamos fazer para melhorar sua experiência?
          </Text>
          <TextInput
            value={improvement}
            onChangeText={setImprovement}
            placeholder="Digite aqui"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 15,
              color: "#111827",
              textAlignVertical: "top",
              minHeight: 80,
            }}
          />
        </View>

        {/* O que gosta */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            O que você mais gosta em nossa empresa?
          </Text>
          <TextInput
            value={likes}
            onChangeText={setLikes}
            placeholder="Digite aqui"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 15,
              color: "#111827",
              textAlignVertical: "top",
              minHeight: 80,
            }}
          />
        </View>

        {/* Intenção de continuidade */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 8 }}>
            Você pretende continuar usando nosso serviço nos próximos meses?
          </Text>
          <TextInput
            value={intention}
            onChangeText={setIntention}
            placeholder="Digite aqui"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 15,
              color: "#111827",
              textAlignVertical: "top",
              minHeight: 60,
            }}
          />
        </View>

        {/* Botão Enviar */}
        <TouchableOpacity activeOpacity={0.9} onPress={handleSubmit} style={{ marginBottom: 30 }}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
              ENVIAR FEEDBACK
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}