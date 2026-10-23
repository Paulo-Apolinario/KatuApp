import type { ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";
export function AccessShell({
  title,
  subtitle,
  eyebrow,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  const wide = useWindowDimensions().width >= 960;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={s.page}
        contentContainerStyle={[s.content, wide && s.wideContent]}
      >
        <View style={[s.layout, wide && s.wideLayout]}>
          <View style={[s.brandPanel, wide && s.wideBrand]}>
            <View style={s.brand}>
              <Image
                source={require("../../../assets/images/logo.png")}
                style={{ width: 44, height: 44 }}
                resizeMode="contain"
                accessibilityLabel="Símbolo KATUÁ"
              />
              <Text style={s.brandName}>KATUÁ</Text>
            </View>
            <Text style={s.brandEyebrow}>GESTÃO DA COLETA SELETIVA</Text>
            {wide && (
              <Text style={[s.hero, { fontSize: 40, lineHeight: 47 }]}>
                Cada coleta conecta{wide ? "\n" : " "}uma nova possibilidade.
              </Text>
            )}
            {wide && (
              <Text style={s.heroCopy}>
                Pessoas, cooperativas e operações em uma rede de reciclagem mais
                organizada.
              </Text>
            )}
            {wide && (
              <View style={s.features}>
                {[
                  ["map-outline", "Rotas e pontos de coleta"],
                  ["layers-outline", "Materiais e rastreabilidade"],
                  ["people-outline", "Cooperativas e equipes"],
                ].map(([icon, label]) => (
                  <View key={label} style={s.feature}>
                    <Ionicons name={icon as any} size={20} color="#A7F3D0" />
                    <Text style={s.featureText}>{label}</Text>
                  </View>
                ))}
              </View>
            )}
            {wide && (
              <Text style={s.brandFooter}>
                Tecnologia a serviço da economia circular.
              </Text>
            )}
          </View>
          <View style={[s.formPanel, wide && s.wideForm]}>
            {onBack && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                onPress={onBack}
                style={s.back}
              >
                <Ionicons name="arrow-back" size={18} color={colors.primary} />
                <Text style={s.backText}>Voltar</Text>
              </Pressable>
            )}
            <Text style={s.eyebrow}>{eyebrow}</Text>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Text style={s.subtitle}>{subtitle}</Text>
            {children}
            <View style={s.footer}>
              <Ionicons
                name="shield-checkmark-outline"
                color={colors.muted}
                size={16}
              />
              <Text style={s.footerText}>
                Acesso individual. Preserve seus dados de entrada.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function ProfileChoice({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        s.choice,
        (pressed || hovered) && s.choiceActive,
      ]}
    >
      <View style={s.choiceIcon}>
        <Ionicons name={icon} size={23} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.choiceTitle}>{title}</Text>
        <Text style={s.choiceDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#64748B" />
    </Pressable>
  );
}
export function AccessLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
      }}
    >
      <Text
        style={{
          color: colors.primary,
          fontWeight: "600",
          fontSize: 14,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  page: { backgroundColor: "#F3F6F5", flex: 1 },
  content: {
    padding: 16,
    paddingBottom: 28,
    flexGrow: 1,
    justifyContent: "center",
  },
  wideContent: { padding: 40 },
  layout: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#DEE7E3",
  },
  wideLayout: { flexDirection: "row", minHeight: 690 },
  brandPanel: { backgroundColor: "#123C35", padding: 24, gap: 12 },
  wideBrand: { width: "45%", padding: 44, justifyContent: "center" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 27,
    fontWeight: "700",
    color: "white",
    letterSpacing: 1,
  },
  brandEyebrow: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: "#A7D9C4",
    marginTop: 8,
  },
  hero: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.7,
  },
  heroCopy: { fontSize: 14, lineHeight: 22, color: "#D1E4DC", maxWidth: 360 },
  brandFooter: { fontSize: 11, color: "#A7C4B8", marginTop: 16 },
  features: { gap: 20, marginTop: 30 },
  feature: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureText: { fontSize: 14, color: "#E0EEE7" },
  formPanel: { padding: 24 },
  wideForm: { width: "55%", padding: 48, justifyContent: "center" },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  backText: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  eyebrow: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    marginTop: 10,
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#E8EFEB",
  },
  footerText: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    flexShrink: 1,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#DDE7E1",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    minHeight: 84,
    backgroundColor: "#FFFFFF",
  },
  choiceActive: { backgroundColor: "#F0F8F4", borderColor: "#3A9673" },
  choiceIcon: {
    width: 46,
    height: 46,
    backgroundColor: "#EAF4EE",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  choiceDescription: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
