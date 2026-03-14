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

type MaterialType = "ALUMÍNIO" | "PLÁSTICO" | "PAPEL" | "VIDRO" | "METAL" | "OUTRO";

export default function ScheduleScreen() {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialType[]>([]);

  const materials: MaterialType[] = ["ALUMÍNIO", "PLÁSTICO", "PAPEL", "VIDRO", "METAL", "OUTRO"];

  const toggleMaterial = (material: MaterialType) => {
    if (selectedMaterials.includes(material)) {
      setSelectedMaterials(selectedMaterials.filter(m => m !== material));
    } else {
      setSelectedMaterials([...selectedMaterials, material]);
    }
  };

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime || selectedMaterials.length === 0) {
      Alert.alert("Atenção", "Preencha todos os campos e selecione pelo menos um material");
      return;
    }

    Alert.alert(
      "Sucesso!",
      "Coleta agendada com sucesso!",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Header com Gradiente */}
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
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            AGENDE SUA COLETA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        style={{ flex: 1, padding: 20 }}
      >
        {/* Card de Data */}
        <View style={{ 
          backgroundColor: "#F9FAFB", 
          borderRadius: 16, 
          padding: 20, 
          marginBottom: 20 
        }}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: "600", 
            color: "#111827", 
            marginBottom: 15 
          }}>
            📅 Data da Coleta
          </Text>
          
          <TextInput
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="Dia / Mês / Ano"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 12,
              padding: 15,
              fontSize: 16,
              color: "#111827",
              backgroundColor: "#FFFFFF",
            }}
          />
        </View>

        {/* Card de Horário */}
        <View style={{ 
          backgroundColor: "#F9FAFB", 
          borderRadius: 16, 
          padding: 20, 
          marginBottom: 20 
        }}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: "600", 
            color: "#111827", 
            marginBottom: 15 
          }}>
            ⏰ Horário da Coleta
          </Text>
          
          <TextInput
            value={selectedTime}
            onChangeText={setSelectedTime}
            placeholder="Preencha o horário da coleta"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 12,
              padding: 15,
              fontSize: 16,
              color: "#111827",
              backgroundColor: "#FFFFFF",
            }}
          />
        </View>

        {/* Card de Materiais */}
        <View style={{ 
          backgroundColor: "#F9FAFB", 
          borderRadius: 16, 
          padding: 20, 
          marginBottom: 30 
        }}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: "600", 
            color: "#111827", 
            marginBottom: 15 
          }}>
            ♻️ Tipos de Resíduos
          </Text>
          
          <View style={{ 
            flexDirection: "row", 
            flexWrap: "wrap", 
            gap: 10 
          }}>
            {materials.map((material) => (
              <TouchableOpacity
                key={material}
                onPress={() => toggleMaterial(material)}
                style={{
                  backgroundColor: selectedMaterials.includes(material) ? "#028C56" : "#FFFFFF",
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 25,
                  marginRight: 10,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: selectedMaterials.includes(material) ? "#028C56" : "#D1D5DB",
                }}
              >
                <Text
                  style={{
                    color: selectedMaterials.includes(material) ? "#FFFFFF" : "#4B5563",
                    fontWeight: "600",
                    fontSize: 14,
                  }}
                >
                  {material}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Botão Agendar */}
        <TouchableOpacity 
          activeOpacity={0.9} 
          onPress={handleSchedule} 
          style={{ marginBottom: 30 }}
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
            }}
          >
            <Text style={{ 
              color: "#FFFFFF", 
              fontSize: 18, 
              fontWeight: "800",
              marginRight: 8 
            }}>
              AGENDAR
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}