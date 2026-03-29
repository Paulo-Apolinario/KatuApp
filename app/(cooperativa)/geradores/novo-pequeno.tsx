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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { generatorService } from "@/src/services/generatorService";

function buildAddress(params: {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}) {
  return [
    params.street.trim(),
    params.number.trim(),
    params.neighborhood.trim(),
    params.city.trim(),
    params.state.trim(),
    params.zipCode.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function NovoPequenoGeradorScreen() {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  const enderecoCompleto = useMemo(() => {
    return buildAddress({
      street: rua,
      number: numero,
      neighborhood: bairro,
      city: cidade,
      state: estado,
      zipCode: cep,
    });
  }, [rua, numero, bairro, cidade, estado, cep]);

  async function buscarCep(value: string) {
    const cleanCep = value.replace(/\D/g, "");

    if (cleanCep.length !== 8) return;

    try {
      setLoadingCep(true);

      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        Alert.alert("CEP não encontrado", "Verifique o CEP informado.");
        return;
      }

      setRua(data.logradouro || "");
      setBairro(data.bairro || "");
      setCidade(data.localidade || "");
      setEstado(data.uf || "");
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      Alert.alert("Erro", "Não foi possível consultar o CEP.");
    } finally {
      setLoadingCep(false);
    }
  }

  async function getCoordinatesFromAddress(address: string) {
    try {
      const results = await Location.geocodeAsync(address);

      if (!results.length) {
        return { latitude: undefined, longitude: undefined };
      }

      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    } catch (error) {
      console.error("Erro ao geocodificar endereço:", error);
      return { latitude: undefined, longitude: undefined };
    }
  }

  async function handleSalvar() {
    const companyName = nome.trim();
    const responsibleName = contato.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = telefone.trim();

    if (
      !companyName ||
      !normalizedPhone ||
      !normalizedEmail ||
      !rua.trim() ||
      !numero.trim() ||
      !bairro.trim() ||
      !cidade.trim() ||
      !estado.trim()
    ) {
      Alert.alert(
        "Atenção",
        "Preencha nome, telefone, email, rua, número, bairro, cidade e estado."
      );
      return;
    }

    try {
      setSaving(true);

      const { latitude, longitude } =
        await getCoordinatesFromAddress(enderecoCompleto);

      const response = await generatorService.createGenerator({
        name: responsibleName || companyName,
        companyName,
        email: normalizedEmail,
        phone: normalizedPhone,
        address: enderecoCompleto,
        zipCode: cep.trim(),
        street: rua.trim(),
        number: numero.trim(),
        neighborhood: bairro.trim(),
        city: cidade.trim(),
        state: estado.trim(),
        latitude,
        longitude,
        type: "SMALL",
      });

      Alert.alert(
        "Gerador salvo com sucesso",
        response.temporaryPassword
          ? `O pequeno gerador foi cadastrado.\n\nSenha provisória: ${response.temporaryPassword}\n\nAgora ele precisa acessar a opção de ativação de acesso com o e-mail informado.`
          : "O pequeno gerador foi cadastrado com sucesso.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(cooperativa)/geradores/pequeno"),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message || "Não foi possível cadastrar o pequeno gerador."
      );
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
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVO PEQUENO GERADOR
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <Field
          label="Nome do estabelecimento *"
          value={nome}
          onChangeText={setNome}
          placeholder="Ex: Mercadinho Nova Opção"
        />
        <Field
          label="Contato responsável"
          value={contato}
          onChangeText={setContato}
          placeholder="Nome do responsável"
        />
        <Field
          label="Telefone *"
          value={telefone}
          onChangeText={setTelefone}
          placeholder="(85) 99999-9999"
          keyboardType="phone-pad"
        />
        <Field
          label="Email *"
          value={email}
          onChangeText={setEmail}
          placeholder="empresa@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: "#111827",
            marginTop: 10,
            marginBottom: 14,
          }}
        >
          Endereço para mapa
        </Text>

        <Field
          label="CEP"
          value={cep}
          onChangeText={(text: string) => {
            const formatted = formatCep(text);
            setCep(formatted);

            const clean = formatted.replace(/\D/g, "");
            if (clean.length === 8) {
              buscarCep(clean);
            }
          }}
          onBlur={() => buscarCep(cep)}
          placeholder="Ex: 60000-000"
          keyboardType="numeric"
        />

        {loadingCep && (
          <View style={{ marginBottom: 14 }}>
            <ActivityIndicator color="#028C56" />
            <Text
              style={{
                fontSize: 12,
                color: "#64748B",
                marginTop: 6,
              }}
            >
              Buscando endereço pelo CEP...
            </Text>
          </View>
        )}

        <Field
          label="Rua *"
          value={rua}
          onChangeText={setRua}
          placeholder="Ex: Rua das Flores"
        />
        <Field
          label="Número *"
          value={numero}
          onChangeText={setNumero}
          placeholder="Ex: 250"
        />
        <Field
          label="Bairro *"
          value={bairro}
          onChangeText={setBairro}
          placeholder="Ex: Centro"
        />
        <Field
          label="Cidade *"
          value={cidade}
          onChangeText={setCidade}
          placeholder="Ex: Fortaleza"
        />
        <Field
          label="Estado *"
          value={estado}
          onChangeText={setEstado}
          placeholder="Ex: CE"
        />

        <View
          style={{
            backgroundColor: "#F8FAFC",
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 6 }}>
            Endereço consolidado
          </Text>
          <Text style={{ fontSize: 14, color: "#111827", fontWeight: "600" }}>
            {enderecoCompleto || "Preencha os campos acima"}
          </Text>
        </View>

        <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 20 }}>
          Ao informar um CEP válido, o sistema tenta preencher rua, bairro, cidade e estado automaticamente e gerar coordenadas para o mapa no momento do cadastro.
        </Text>

        <TouchableOpacity onPress={handleSalvar} disabled={saving} activeOpacity={0.9}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 10,
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
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: "800",
                    marginLeft: 8,
                  }}
                >
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
                SALVAR PEQUENO GERADOR
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: any) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        style={{
          borderWidth: 1,
          borderColor: "#D1D5DB",
          borderRadius: 10,
          padding: 12,
          color: "#111827",
          fontSize: 16,
        }}
      />
    </View>
  );
}