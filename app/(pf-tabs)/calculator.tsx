import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { ResidentialPage } from "@/src/components/residential/ResidentialPage";
import { Card, Field, Action, Notice } from "@/src/components/ui/Workspace";
import { decimalValue, numberBR, separationTip } from "@/src/utils/residential";
const names = ["Papel e papelão", "Plástico", "Vidro", "Alumínio", "Outros metais", "Outros recicláveis"];
export default function ResidentialCalculator() {
  const current = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", month: "2-digit", year: "numeric" }).format(new Date());
  const [month, setMonth] = useState(current), [values, setValues] = useState<Record<string, string>>({});
  const materials = useMemo(() => names.map(name => ({ name, kg: decimalValue(values[name] || "") })), [values]);
  function moveMonth(offset: number) { const [m, y] = month.split("/").map(Number); if (!m || !y || m > 12) { setMonth(current); return; } const next = new Date(Date.UTC(y, m - 1 + offset, 1)); setMonth(next.toLocaleDateString("pt-BR", { timeZone: "UTC", month: "2-digit", year: "numeric" })); }
  const invalid = materials.some(m => m.kg === null), total = materials.reduce((sum, m) => sum + (m.kg || 0), 0);
  return <ResidentialPage title="Planejar a separação" back subtitle="Faça uma estimativa dos recicláveis da sua residência.">
    <Card><Field label="Mês de referência (MM/AAAA)" value={month} onChangeText={value => { const d = value.replace(/\D/g, "").slice(0, 6); setMonth(d.slice(0, 2) + (d.length > 2 ? "/" + d.slice(2) : "")); }} keyboardType="number-pad" maxLength={7} />{! /^(0[1-9]|1[0-2])\/20\d{2}$/.test(month) && <Notice error text="Informe um mês válido, por exemplo 10/2026." />}<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Action secondary label="Mês anterior" onPress={() => moveMonth(-1)} /><Action secondary label="Mês atual" onPress={() => setMonth(current)} /><Action secondary label="Mês seguinte" onPress={() => moveMonth(1)} /></View></Card>
    <Card><Text style={{ fontSize: 18, fontWeight: "700" }}>Quantidades estimadas em kg</Text>{names.map(name => <View key={name}><Field label={name} value={values[name] || ""} onChangeText={value => setValues(old => ({ ...old, [name]: value }))} keyboardType="decimal-pad" maxLength={12} placeholder="0,0" />{!!values[name] && <Notice text={separationTip(name)} />}</View>)}{invalid && <Notice error text="Use quantidades positivas com vírgula ou ponto decimal. Valores negativos e textos não são aceitos." />}</Card>
    <Card><Text style={{ fontSize: 18, fontWeight: "700" }}>Resumo de {month}</Text><Text style={{ fontSize: 32, color: "#17694F", fontWeight: "700" }}>{invalid ? "Corrija os valores" : `${numberBR(total, 2)} kg estimados`}</Text><Notice text="Esta simulação não gera solicitação, não cria estoque e não soma peso à sua participação. O peso real será registrado na coleta e conferido pela cooperativa." /></Card>
    <Action secondary label="Limpar quantidades" onPress={() => setValues({})} />
  </ResidentialPage>;
}
