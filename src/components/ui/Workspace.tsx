import { router } from "expo-router";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  type TextInputProps,
} from "react-native";
import { colors } from "../../theme/colors";
import { spacing } from "../../theme/spacing";
export function Workspace({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollView
      style={styles.page}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={{ color: colors.primary }}>← Voltar</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
      </View>
      {children}
    </ScrollView>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Action({
  label,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.action,
        {
          backgroundColor: secondary ? colors.surface : colors.primary,
          opacity: disabled || busy ? 0.5 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.primary : "white"} />
      ) : (
        <Text
          style={{
            color: secondary ? colors.primary : "white",
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.style]}
      />
    </View>
  );
}
export function Notice({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  return (
    <Text
      accessibilityRole={error ? "alert" : "text"}
      style={[styles.notice, { color: error ? colors.danger : colors.muted }]}
    >
      {text}
    </Text>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
  },
  header: { paddingVertical: 16, gap: 8 },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { fontSize: 26, fontWeight: "800", color: colors.text },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.radius,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  label: { color: colors.text, fontWeight: "600", marginBottom: 6 },
  input: {
    minHeight: spacing.control,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 12,
    fontSize: 16,
  },
  action: {
    minHeight: spacing.control,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 12,
    justifyContent: "center",
    marginVertical: 6,
  },
  notice: { fontSize: 14, lineHeight: 22, marginVertical: 8 },
});
