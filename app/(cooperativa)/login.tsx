import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

export default function CooperativaLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState("Jijoca de Jericoacoara");

  useEffect(() => {
    getUserLocation();
  }, []);

  async function getUserLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (addresses.length > 0) {
          const address = addresses[0];
          const city = address.city || address.region || "Jijoca de Jericoacoara";
          setLocationName(city);
        }
      }
    } catch (error) {
      console.error("Erro ao obter localização:", error);
    }
  }

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha e-mail e senha");
      return;
    }

    setLoading(true);
    
    // Simular login (depois substituir por Firebase)
    setTimeout(() => {
      setLoading(false);
      // REDIRECIONAR PARA A HOME, NÃO PARA O DASHBOARD
      router.replace("/(cooperativa)/home.tsx" as any);
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 30,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 50, height: 50, marginRight: 8 }}
            />
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>
              KATU
            </Text>
          </View>

          <View style={{ width: 24 }} />
        </View>

        <Text style={{ fontSize: 22, fontWeight: "700", color: "#FFFFFF", marginTop: 20, textAlign: "center" }}>
          Cooperativa de Reciclagem
        </Text>
        
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10 }}>
          <Ionicons name="location-sharp" size={16} color="#FFFFFF" />
          <Text style={{ fontSize: 14, color: "#FFFFFF", marginLeft: 5, opacity: 0.9 }}>
            {locationName}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
      >
        <View style={{ paddingHorizontal: 24, paddingVertical: 20 }}>
          {/* Título da seção */}
          <View style={{ marginBottom: 30 }}>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#111827", textAlign: "center" }}>
              Acesso
            </Text>
            <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 5 }}>
              Faça login para acessar o painel da cooperativa
            </Text>
          </View>

          {/* Card de Informações da Cooperativa */}
          <View style={{
            backgroundColor: "#F0FDF4",
            borderRadius: 16,
            padding: 16,
            marginBottom: 25,
            borderWidth: 1,
            borderColor: "#028C56",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Ionicons name="business" size={24} color="#028C56" />
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#028C56", marginLeft: 10 }}>
                Cooperativa da Jeri
              </Text>
            </View>
            
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
              <Ionicons name="time-outline" size={16} color="#4B5563" />
              <Text style={{ fontSize: 13, color: "#4B5563", marginLeft: 8 }}>
                Atua de 06:30 às 18:30
              </Text>
            </View>
            
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="call-outline" size={16} color="#4B5563" />
              <Text style={{ fontSize: 13, color: "#4B5563", marginLeft: 8 }}>
                (88) 90000-0000
              </Text>
            </View>
          </View>

          {/* Email */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="mail-outline" size={20} color="#028C56" />
              <Text style={{ color: "#028C56", marginLeft: 8, fontWeight: "500" }}>
                E-mail
              </Text>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="cooperativa@email.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 8,
                padding: 15,
                fontSize: 16,
                color: "#111827",
                backgroundColor: "#F9FAFB",
              }}
            />
          </View>

          {/* Senha */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="lock-closed-outline" size={20} color="#028C56" />
                <Text style={{ color: "#028C56", marginLeft: 8, fontWeight: "500" }}>
                  Senha
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#028C56"
                />
              </TouchableOpacity>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 8,
                padding: 15,
                fontSize: 16,
                color: "#111827",
                backgroundColor: "#F9FAFB",
              }}
            />
          </View>

          {/* Esqueceu senha */}
          <TouchableOpacity style={{ alignSelf: "flex-end", marginBottom: 25 }}>
            <Text style={{ fontSize: 14, color: "#028C56", fontWeight: "500" }}>
              Esqueceu a senha?
            </Text>
          </TouchableOpacity>

          {/* Botão Login */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleLogin}
            disabled={loading}
            style={{ marginBottom: 20 }}
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
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                {loading ? "ENTRANDO..." : "ENTRAR"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Solicitar acesso */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 10 }}>
            <Text style={{ color: "#4B5563" }}>Não tem uma conta? </Text>
            <TouchableOpacity onPress={() => Alert.alert("Atenção", "Entre em contato com a administração da cooperativa para solicitar seu acesso.")}>
              <Text style={{ color: "#028C56", fontWeight: "700", textDecorationLine: "underline" }}>
                Solicitar acesso
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}