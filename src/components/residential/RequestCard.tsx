import { router } from "expo-router";
import { Text, View } from "react-native";
import { Action, Card } from "../ui/Workspace";
import { residentialDate, residentialProgress } from "../../utils/residential";
import { ResidentialRequest } from "../../services/residentialService";
export function RequestCard({ request: r }: { request: Pick<ResidentialRequest, "id" | "status" | "cooperative" | "scheduledDate" | "preferredDate"> & { collections?: { status: string }[] } }) {
  return <Card><View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><Text style={{ color: "#17694F", fontWeight: "700" }}>{residentialProgress(r)}</Text><Text>#{r.id.slice(-8).toUpperCase()}</Text></View>
    <Text style={{ fontSize: 17, fontWeight: "700" }}>{r.cooperative?.name || "Cooperativa responsável"}</Text>
    <Text>{r.scheduledDate ? "Confirmada: " + residentialDate(r.scheduledDate) : "Preferência: " + residentialDate(r.preferredDate)}</Text>
    <Action secondary label="Acompanhar solicitação" onPress={() => router.push({ pathname: "/(pf-tabs)/request-details", params: { id: r.id } })} />
  </Card>;
}
