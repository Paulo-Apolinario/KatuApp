import { View, Text, StyleSheet } from "react-native";

type Props = {
  latitude?: number;
  longitude?: number;
  title?: string;
};

export default function OperationalMapWeb({
  latitude,
  longitude,
  title = "Mapa operacional",
}: Props) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number"
  ) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>Localização indisponível para exibição no navegador.</Text>
      </View>
    );
  }

  const src = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <iframe
        src={src}
        style={{ ...styles.iframe, border: "none" } as any}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    minHeight: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    padding: 12,
  },
  text: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    color: "#6B7280",
  },
  iframe: {
    width: "100%",
    height: 320,
  },
});