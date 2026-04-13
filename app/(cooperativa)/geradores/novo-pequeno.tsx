import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { api } from "@/src/services/api";
import { generatorService } from "@/src/services/generatorService";
import { generatorDraftStore } from "@/src/stores/generatorDraftStore";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

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
  const params = useLocalSearchParams<{
    selectedLatitude?: string;
    selectedLongitude?: string;
  }>();

  const draft = generatorDraftStore.get("SMALL");

  const [nome, setNome] = useState(draft.nome);
  const [contato, setContato] = useState(draft.contato);
  const [telefone, setTelefone] = useState(draft.telefone);
  const [email, setEmail] = useState(draft.email);

  const [cep, setCep] = useState(draft.cep);
  const [rua, setRua] = useState(draft.rua);
  const [numero, setNumero] = useState(draft.numero);
  const [bairro, setBairro] = useState(draft.bairro);
  const [cidade, setCidade] = useState(draft.cidade);
  const [estado, setEstado] = useState(draft.estado);
  const [address, setAddress] = useState(draft.address);

  const [latitude, setLatitude] = useState(draft.latitude);
  const [longitude, setLongitude] = useState(draft.longitude);

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

  useEffect(() => {
    const nextLat =
      typeof params.selectedLatitude === "string" ? params.selectedLatitude : "";
    const nextLng =
      typeof params.selectedLongitude === "string"
        ? params.selectedLongitude
        : "";

    if (nextLat && nextLng) {
      setLatitude(nextLat);
      setLongitude(nextLng);
    }
  }, [params.selectedLatitude, params.selectedLongitude]);

  useEffect(() => {
    generatorDraftStore.set({
      kind: "SMALL",
      nome,
      contato,
      telefone,
      email,
      cep,
      rua,
      numero,
      bairro,
      cidade,
      estado,
      address,
      latitude,
      longitude,
    });
  }, [
    nome,
    contato,
    telefone,
    email,
    cep,
    rua,
    numero,
    bairro,
    cidade,
    estado,
    address,
    latitude,
    longitude,
  ]);

  async function buscarCep(value: string) {
    const cleanCep = value.replace(/\D/g, "");

    if (cleanCep.length !== 8) return;

    try {
      setLoadingCep(true);

      const data = await api.getExternalJson<ViaCepResponse>(
        `https://viacep.com.br/ws/${cleanCep}/json/`
      );

      if (data.erro) {
        Alert.alert("CEP não encontrado", "Verifique o CEP informado.");
        return;
      }

      setRua(data.logradouro || "");
      setBairro(data.bairro || "");
      setCidade(data.localidade || "");
      setEstado(data.uf || "");

      const nextAddress = [
        data.logradouro || "",
        numero.trim(),
        data.bairro || "",
        data.localidade || "",
        data.uf || "",
        cleanCep,
      ]
        .filter(Boolean)
        .join(", ");

      setAddress(nextAddress);
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      Alert.alert("Erro", "Não foi possível consultar o CEP.");
    } finally {
      setLoadingCep(false);
    }
  }

  function handleOpenMap() {
    generatorDraftStore.set({
      kind: "SMALL",
      nome,
      contato,
      telefone,
      email,
      cep,
      rua,
      numero,
      bairro,
      cidade,
      estado,
      address,
      latitude,
      longitude,
    });

    router.push({
      pathname: "/(cooperativa)/geradores/select-location",
      params: {
        kind: "SMALL",
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      },
    });
  }

  async function handleSalvar() {
    const companyName = nome.trim();
    const responsibleName = contato.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = telefone.trim();

    if (!companyName || !normalizedPhone || !normalizedEmail) {
      Alert.alert(
        "Atenção",
        "Preencha nome do estabelecimento, telefone e email."
      );
      return;
    }

    if (
      !rua.trim() &&
      !bairro.trim() &&
      !cidade.trim() &&
      !(latitude.trim() && longitude.trim())
    ) {
      Alert.alert(
        "Atenção",
        "Informe o endereço ou selecione a localização no mapa."
      );
      return;
    }

    try {
      setSaving(true);

      const finalAddress = address.trim() || enderecoCompleto;

      const response = await generatorService.createGenerator({
        name: responsibleName || companyName,
        companyName,
        email: normalizedEmail,
        phone: normalizedPhone,
        address: finalAddress || undefined,
        zipCode: cep.replace(/\D/g, "") || undefined,
        street: rua.trim() || undefined,
        number: numero.trim() || undefined,
        neighborhood: bairro.trim() || undefined,
        city: cidade.trim() || undefined,
        state: estado.trim() || undefined,
        latitude: latitude.trim() ? Number(latitude) : undefined,
        longitude: longitude.trim() ? Number(longitude) : undefined,
        type: "SMALL",
      });

      generatorDraftStore.clear("SMALL");

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
          Endereço e localização
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
          loading={loadingCep}
        />

        <Field
          label="Rua"
          value={rua}
          onChangeText={setRua}
          placeholder="Ex: Rua das Flores"
        />
        <Field
          label="Número"
          value={numero}
          onChangeText={(value: string) => {
            setNumero(value);

            const nextAddress = buildAddress({
              street: rua,
              number: value,
              neighborhood: bairro,
              city: cidade,
              state: estado,
              zipCode: cep,
            });

            setAddress(nextAddress);
          }}
          placeholder="Ex: 250"
        />
        <Field
          label="Bairro"
          value={bairro}
          onChangeText={setBairro}
          placeholder="Ex: Centro"
        />
        <Field
          label="Cidade"
          value={cidade}
          onChangeText={setCidade}
          placeholder="Ex: Fortaleza"
        />
        <Field
          label="Estado"
          value={estado}
          onChangeText={setEstado}
          placeholder="Ex: CE"
        />

        <Field
          label="Endereço consolidado"
          value={address}
          onChangeText={setAddress}
          placeholder="Resumo do endereço"
        />

        <TouchableOpacity
          onPress={handleOpenMap}
          activeOpacity={0.88}
          style={{
            backgroundColor: "#F0FDF4",
            borderWidth: 1,
            borderColor: "#BBF7D0",
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
            marginTop: 8,
          }}
        >
          <Ionicons name="map-outline" size={18} color="#028C56" />
          <Text
            style={{
              marginLeft: 8,
              color: "#028C56",
              fontWeight: "800",
              fontSize: 14,
            }}
          >
            SELECIONAR NO MAPA
          </Text>
        </TouchableOpacity>

        {(latitude || longitude) ? (
          <View
            style={{
              backgroundColor: "#ECFDF5",
              borderWidth: 1,
              borderColor: "#A7F3D0",
              borderRadius: 14,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <Text style={{ color: "#065F46", fontWeight: "800", fontSize: 13 }}>
              Localização selecionada
            </Text>
            <Text style={{ color: "#065F46", marginTop: 6, fontSize: 13 }}>
              Latitude: {latitude || "-"}
            </Text>
            <Text style={{ color: "#065F46", marginTop: 4, fontSize: 13 }}>
              Longitude: {longitude || "-"}
            </Text>
          </View>
        ) : null}

        
        <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 20 }}>
          Você pode usar o CEP para preenchimento automático e, se necessário,
          marcar o ponto exato no mapa.
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

function Field(props: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onBlur?: () => void;
  loading?: boolean;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
        {props.label}
      </Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: "#D1D5DB",
          borderRadius: 10,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          onBlur={props.onBlur}
          placeholder={props.placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
          style={{
            flex: 1,
            paddingVertical: 12,
            color: "#111827",
            fontSize: 16,
          }}
        />
        {props.loading ? <ActivityIndicator size="small" color="#028C56" /> : null}
      </View>
    </View>
  );
}