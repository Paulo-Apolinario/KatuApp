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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type AlertPoint = {
  id: number;
  name: string;
  address: string;
  status: "Atrasado" | "Acumulado" | "Solicitação";
  days: number;
};

export default function AlertsScreen() {
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [currentDriver] = useState("Joãozinho");
  const [currentPlate] = useState("SBT1234");
  const [totalLixo] = useState(412);

  const [alertPoints, setAlertPoints] = useState<AlertPoint[]>([
    {
      id: 1,
      name: "ATACADÃO DO VALE",
      address: "Av. Principal, 123",
      status: "Atrasado",
      days: 2,
    },
    {
      id: 2,
      name: "BAR DO VALMAL",
      address: "Rua das Flores, 45",
      status: "Acumulado",
      days: 3,
    },
    {
      id: 3,
      name: "MERCADINHO NOVA OPÇÃO",
      address: "Praça Central, 78",
      status: "Solicitação",
      days: 1,
    },
    {
      id: 4,
      name: "ATACADÃO DO VALE",
      address: "Filial - Centro",
      status: "Atrasado",
      days: 4,
    },
    {
      id: 5,
      name: "ATACADÃO DO VALE",
      address: "Filial - Praia",
      status: "Atrasado",
      days: 2,
    },
  ]);

  const selectedPoint = useMemo(
    () => alertPoints.find((item) => item.id === selectedPointId) ?? null,
    [alertPoints, selectedPointId]
  );

  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formStatus, setFormStatus] = useState<AlertPoint["status"]>("Atrasado");

  const handleEdit = (point: AlertPoint) => {
    setSelectedPointId(point.id);
    setFormName(point.name);
    setFormAddress(point.address);
    setFormStatus(point.status);
    setEditMode(true);
  };

  const handleSaveEdit = () => {
    if (!selectedPointId) return;

    if (!formName.trim() || !formAddress.trim()) {
      Alert.alert("Atenção", "Preencha o nome e o endereço do ponto.");
      return;
    }

    setAlertPoints((prev) =>
      prev.map((point) =>
        point.id === selectedPointId
          ? {
              ...point,
              name: formName.trim(),
              address: formAddress.trim(),
              status: formStatus,
            }
          : point
      )
    );

    Alert.alert("Sucesso", "Ponto atualizado com sucesso!", [
      {
        text: "OK",
        onPress: () => {
          setEditMode(false);
          setSelectedPointId(null);
        },
      },
    ]);
  };

  const handleDeletePoint = (point: AlertPoint) => {
    Alert.alert(
      "Confirmar exclusão",
      `Deseja realmente excluir ${point.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            setAlertPoints((prev) => prev.filter((item) => item.id !== point.id));
            if (selectedPointId === point.id) {
              setSelectedPointId(null);
              setEditMode(false);
            }
            Alert.alert("Sucesso", "Ponto excluído com sucesso!");
          },
        },
      ]
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={() => router.replace("/(cooperativa)/home")}>
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

          <TouchableOpacity onPress={() => setEditMode((prev) => !prev)}>
            <Ionicons
              name={editMode ? "close-outline" : "create-outline"}
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 24, fontWeight: "700", color: "#FFFFFF", marginTop: 15 }}>
          EDITAR PONTOS
        </Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 25,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
            <Ionicons name="person-circle-outline" size={40} color="#028C56" />
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
                {currentDriver}
              </Text>
              <Text style={{ fontSize: 14, color: "#6B7280" }}>
                PLACA: {currentPlate}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 12,
              padding: 15,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
              TOTAL DE LIXO COLETADO
            </Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#028C56" }}>
              {totalLixo} kg
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#111827",
            marginBottom: 15,
          }}
        >
          Pontos de Alerta
        </Text>

        {alertPoints.map((point) => (
          <View
            key={point.id}
            style={{
              backgroundColor: "#FEF2F2",
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: "#FECACA",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#DC2626",
                      marginLeft: 6,
                    }}
                  >
                    {point.name}
                  </Text>
                </View>

                <Text style={{ fontSize: 14, color: "#6B7280", marginLeft: 24 }}>
                  {point.address}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginLeft: 24,
                    marginTop: 4,
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#DC2626",
                      borderRadius: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>
                      {point.status} • {point.days} {point.days === 1 ? "dia" : "dias"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: "row", marginLeft: 12 }}>
                <TouchableOpacity
                  onPress={() => handleEdit(point)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    marginRight: 8,
                    borderWidth: 1,
                    borderColor: "#028C56",
                  }}
                >
                  <Text style={{ color: "#028C56", fontSize: 12, fontWeight: "600" }}>
                    EDITAR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeletePoint(point)}
                  style={{
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: "#DC2626",
                  }}
                >
                  <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "600" }}>
                    EXCLUIR
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {editMode && selectedPoint && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 20,
              marginTop: 20,
              marginBottom: 30,
              borderWidth: 2,
              borderColor: "#028C56",
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 15 }}>
              Editar ponto
            </Text>

            <View style={{ marginBottom: 15 }}>
              <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                Nome do ponto
              </Text>
              <TextInput
                value={formName}
                onChangeText={setFormName}
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

            <View style={{ marginBottom: 15 }}>
              <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                Endereço
              </Text>
              <TextInput
                value={formAddress}
                onChangeText={setFormAddress}
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
              <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                Status
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {(["Atrasado", "Acumulado", "Solicitação"] as AlertPoint["status"][]).map(
                  (status) => {
                    const selected = formStatus === status;

                    return (
                      <TouchableOpacity
                        key={status}
                        onPress={() => setFormStatus(status)}
                        style={{
                          backgroundColor: selected ? "#DC2626" : "#F3F4F6",
                          paddingHorizontal: 15,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 10,
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? "#FFFFFF" : "#4B5563",
                            fontWeight: "600",
                            fontSize: 13,
                          }}
                        >
                          {status}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => {
                  setEditMode(false);
                  setSelectedPointId(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#F3F4F6",
                  padding: 15,
                  borderRadius: 8,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#4B5563", fontWeight: "600" }}>CANCELAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveEdit}
                style={{
                  flex: 1,
                  backgroundColor: "#028C56",
                  padding: 15,
                  borderRadius: 8,
                  marginLeft: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>SALVAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => Alert.alert("Novo ponto", "Funcionalidade em desenvolvimento")}
          style={{
            backgroundColor: "#F0FDF4",
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 10,
            marginBottom: 30,
            borderWidth: 1,
            borderColor: "#028C56",
            borderStyle: "dashed",
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color="#028C56" />
          <Text style={{ fontSize: 16, color: "#028C56", fontWeight: "600", marginLeft: 8 }}>
            ADICIONAR NOVO PONTO
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}