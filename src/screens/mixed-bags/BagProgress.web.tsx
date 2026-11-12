import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { api } from "../../services/api";
import {
  FieldButton,
  FieldInput,
  LoadState,
  useFieldData,
  ui,
} from "../../components/cooperative/FieldUI";
const today = () =>
  new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const prior = (end: string, n: number) =>
  new Date(new Date(end + "T12:00:00Z").getTime() - (n - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
const kg = (v: any) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    Number(v || 0),
  ) + " kg";
const pct = (v: number | null) =>
  v === null
    ? "Sem base"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v) +
      "%";
const buckets: Record<string, string> = {
  ALL: "Todas as bags",
  PENDING: "Com saldo a triar",
  SORTED: "Com material separado",
  REJECTED: "Com rejeitos",
  COMPLETED: "Concluídas",
};
export default function BagProgress({
  context,
  openBag,
}: {
  context: any;
  openBag: (id: string) => void;
}) {
  const initial = {
    start: prior(today(), 30),
    end: today(),
    participantId: context.collectorId || "",
    bucket: "ALL",
    itemId: "",
    page: 1,
    eventPage: 1,
  };
  const [q, setQ] = useState(initial),
    [draft, setDraft] = useState(initial),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState("bags");
  const resource = useFieldData(
    useCallback(
      () =>
        api.get<any>(
          "/mixed-bags/report?" +
            new URLSearchParams(
              Object.fromEntries(
                Object.entries(q).map(([k, v]) => [k, String(v)]),
              ),
            ),
          true,
        ),
      [q],
    ),
  );
  const [showDaily, setShowDaily] = useState(false);
  const d = resource.data;
  const detailRef = useRef<any>(null),
    focus = useRef<any>(null);
  useEffect(() => {
    if (
      focus.current &&
      d &&
      d !== focus.current.previous &&
      !resource.loading
    ) {
      detailRef.current?.scrollIntoView?.({
        behavior: "smooth",
        block: "start",
      });
      focus.current = null;
    }
  }, [d, resource.loading]);
  const apply = (start: string, end: string) => {
    const next = { ...initial, start, end, participantId: draft.participantId };
    setQ(next);
    setDraft(next);
  };
  const detail = (bucket: string) => {
    focus.current = { previous: d };
    setQ((f) => ({ ...f, bucket, page: 1 }));
    setTab("bags");
  };
  return (
    <>
      <View style={ui.card}>
        <Text style={ui.heading}>Acompanhamento da triagem</Text>
        <Text style={ui.muted}>
          Data inicial e final no formato AAAA-MM-DD. Horário de Fortaleza.
        </Text>
        <FieldInput
          label="Data inicial da triagem"
          value={draft.start}
          onChangeText={(start) => setDraft((f) => ({ ...f, start }))}
        />
        <FieldInput
          label="Data final da triagem"
          value={draft.end}
          onChangeText={(end) => setDraft((f) => ({ ...f, end }))}
        />
        <Text style={ui.body}>
          Participante:{" "}
          {draft.participantId
            ? d?.people.find((p: any) => p.id === draft.participantId)?.name ||
              context.people.find((p: any) => p.id === draft.participantId)
                ?.name ||
              "Selecionado"
            : "Toda a equipe"}
        </Text>
        <FieldButton
          secondary
          label="Toda a equipe"
          onPress={() => setDraft((f) => ({ ...f, participantId: "" }))}
        />
        <FieldInput
          label="Buscar participante"
          value={search}
          onChangeText={setSearch}
        />
        {search.length >= 2 &&
          (d?.people || context.people)
            .filter((p: any) =>
              p.name.toLowerCase().includes(search.toLowerCase()),
            )
            .slice(0, 20)
            .map((p: any) => (
              <FieldButton
                key={p.id}
                secondary={draft.participantId !== p.id}
                label={p.name}
                onPress={() => {
                  setDraft((f) => ({ ...f, participantId: p.id }));
                  setSearch("");
                }}
              />
            ))}
        <FieldButton
          label="Aplicar filtros da triagem"
          onPress={() => apply(draft.start, draft.end)}
        />
        <View style={ui.row}>
          {[
            ["Hoje", today()],
            ["7 dias", prior(today(), 7)],
            ["30 dias", prior(today(), 30)],
            ["Este mês", today().slice(0, 7) + "-01"],
            ["Este ano", today().slice(0, 4) + "-01-01"],
          ].map(([label, start]) => (
            <FieldButton
              key={label}
              secondary
              label={label}
              onPress={() => apply(start, today())}
            />
          ))}
        </View>
        <FieldButton
          secondary
          label="Atualizar acompanhamento"
          onPress={resource.refresh}
        />
      </View>
      <LoadState resource={resource} />
      {d && (
        <>
          <Text style={ui.small}>
            Participante aplicado:{" "}
            {d.people.find((p: any) => p.id === d.meta.participantId)?.name ||
              "Toda a equipe"}{" "}
            · Período aplicado: {d.meta.start} a {d.meta.end} ·{" "}
            {d.meta.partial ? "Dia atual parcial · " : ""}Atualizado em{" "}
            {new Date(d.meta.generatedAt).toLocaleString("pt-BR", {
              timeZone: "America/Fortaleza",
            })}
          </Text>
          <View style={ui.card}>
            <Text style={ui.heading}>Bags recebidas no período</Text>
            <Text style={ui.muted}>
              Saldo atual dessas bags, incluindo triagens posteriores ao
              período. Quando uma pessoa é filtrada, entram somente bags com
              pesagens em que ela participou no período.
            </Text>
            {[
              ["Recebido líquido", kg(d.cohort.receivedKg), "ALL"],
              ["Separado em lotes", kg(d.cohort.sortedKg), "SORTED"],
              ["Rejeitos", kg(d.cohort.rejectedKg), "REJECTED"],
              ["Ainda por triar", kg(d.cohort.pendingKg), "PENDING"],
              [
                "Bags concluídas",
                `${d.cohort.completed} de ${d.cohort.bags}`,
                "COMPLETED",
              ],
            ].map(([label, value, bucket]) => (
              <FieldButton
                key={label}
                secondary
                label={`${label}: ${value} · Ver bags`}
                onPress={() => detail(bucket)}
              />
            ))}
            <Text style={ui.body}>
              Separado: {pct(d.cohort.recoveredPercent)} · Rejeitos:{" "}
              {pct(d.cohort.rejectedPercent)}
            </Text>
            <Text style={ui.small}>
              O saldo pendente ainda não representa rejeito.
            </Text>
          </View>
          <View style={ui.card}>
            <Text style={ui.heading}>Produção realizada no período</Text>
            <Text style={ui.body}>
              {kg(d.production.sortedKg)} separados ·{" "}
              {kg(d.production.rejectedKg)} de rejeitos ·{" "}
              {d.production.operations} pesagens
            </Text>
            <Text style={ui.muted}>
              Pesagens lançadas no período, inclusive de bags recebidas antes.
              Não some os pesos da produção aos do recebimento.
            </Text>
            {d.materials.map((m: any) => (
              <FieldButton
                key={m.itemId}
                secondary
                label={`${m.name}: ${kg(m.quantityKg)} · Ver pesagens`}
                onPress={() => {
                  focus.current = { previous: d };
                  setQ((f) => ({ ...f, itemId: m.itemId, eventPage: 1 }));
                  setTab("events");
                }}
              />
            ))}
          </View>
          <View style={ui.card}>
            <Text style={ui.heading}>Concentração diária da triagem</Text>
            <Text style={ui.small}>
              Quanto mais escuro, maior o peso separado. Escala de 0 a{" "}
              {kg(Math.max(0, ...d.series.map((s: any) => Number(s.sortedKg))))}{" "}
              nesta seleção.
            </Text>
            <FieldButton
              secondary
              label={
                showDaily ? "Ocultar mapa de calor" : "Mostrar mapa de calor"
              }
              onPress={() => setShowDaily((v) => !v)}
            />
            {showDaily && (
              <View style={ui.row}>
                {d.series.map((s: any) => {
                  const max = Math.max(
                      1,
                      ...d.series.map((r: any) => Number(r.sortedKg)),
                    ),
                    ratio = Number(s.sortedKg) / max;
                  return (
                    <View
                      key={s.date}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor:
                          ratio === 0
                            ? "#f1f4f3"
                            : `hsl(158,48%,${95 - ratio * 65}%)`,
                        width: 135,
                      }}
                    >
                      <Text
                        style={{
                          color: ratio > 0.6 ? "white" : "#123c2b",
                          fontSize: 12,
                        }}
                      >
                        {s.date.split("-").reverse().join("/")}
                      </Text>
                      <Text
                        style={{
                          color: ratio > 0.6 ? "white" : "#123c2b",
                          fontWeight: "700",
                        }}
                      >
                        {kg(s.sortedKg)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
          <View style={ui.row}>
            {[
              ["bags", "Bags e rendimento"],
              ["events", "Histórico de pesagens"],
              ["people", "Participantes"],
            ].map(([key, label]) => (
              <FieldButton
                key={key}
                secondary={tab !== key}
                label={label}
                onPress={() => setTab(key)}
              />
            ))}
          </View>
          {tab === "people" && (
            <View style={ui.card}>
              <Text style={ui.heading}>Participação na triagem</Text>
              <Text style={ui.muted}>
                Quilos das operações coletivas com participação. A mesma pesagem
                pode aparecer em várias pessoas. Não some estas linhas nem trate
                os valores como produção individual.
              </Text>
              {d.participants.length ? (
                d.participants.map((p: any) => (
                  <View key={p.id} style={{ gap: 6, paddingVertical: 10 }}>
                    <Text style={ui.body}>
                      {p.name} · {p.operations} pesagens · {p.bags} bags
                    </Text>
                    <Text style={ui.badge}>
                      {kg(p.collectiveKg)} em operações com participação
                    </Text>
                    <FieldButton
                      secondary
                      label={`Consultar participação de ${p.name}`}
                      onPress={() => {
                        const next = {
                          ...q,
                          participantId: p.id,
                          page: 1,
                          eventPage: 1,
                        };
                        setQ(next);
                        setDraft(next);
                      }}
                    />
                  </View>
                ))
              ) : (
                <Text style={ui.body}>Nenhuma participação nesta seleção.</Text>
              )}
            </View>
          )}
          {tab === "bags" && (
            <View ref={detailRef} style={ui.card}>
              <Text style={ui.heading}>{buckets[q.bucket]}</Text>
              {q.bucket !== "ALL" && (
                <FieldButton
                  secondary
                  label="Mostrar todas as bags do período"
                  onPress={() => detail("ALL")}
                />
              )}
              <Text style={ui.muted}>
                Bags recebidas no período, com os saldos atuais.
              </Text>
              {d.bags.items.map((b: any) => (
                <View key={b.id} style={{ gap: 6, paddingVertical: 10 }}>
                  <Text style={ui.heading}>{b.code}</Text>
                  <Text style={ui.body}>{b.originLabel}</Text>
                  <Text style={ui.body}>
                    Líquido {kg(b.netKg)} · separado {kg(b.sortedKg)} · rejeitos{" "}
                    {kg(b.rejectedKg)} · por triar {kg(b.remainingKg)}
                  </Text>
                  <Text style={ui.badge}>
                    Rendimento: {pct(b.recoveredPercent)}
                  </Text>
                  <FieldButton
                    secondary
                    label={`Abrir ${b.code}`}
                    onPress={() => openBag(b.id)}
                  />
                </View>
              ))}
              {!d.bags.items.length && (
                <Text style={ui.body}>Nenhuma bag neste detalhe.</Text>
              )}
              <View style={ui.row}>
                <FieldButton
                  secondary
                  label="Bags anteriores"
                  disabled={q.page <= 1}
                  onPress={() => setQ((f) => ({ ...f, page: f.page - 1 }))}
                />
                <Text>
                  {q.page}/{d.bags.pagination.totalPages}
                </Text>
                <FieldButton
                  secondary
                  label="Próximas bags"
                  disabled={q.page >= d.bags.pagination.totalPages}
                  onPress={() => setQ((f) => ({ ...f, page: f.page + 1 }))}
                />
              </View>
            </View>
          )}
          {tab === "events" && (
            <View ref={detailRef} style={ui.card}>
              <Text style={ui.heading}>Histórico de pesagens no período</Text>
              {q.itemId && (
                <FieldButton
                  secondary
                  label="Mostrar todos os materiais"
                  onPress={() =>
                    setQ((f) => ({ ...f, itemId: "", eventPage: 1 }))
                  }
                />
              )}{" "}
              {d.events.items.map((e: any) => (
                <View key={e.id} style={{ gap: 6, paddingVertical: 10 }}>
                  <Text style={ui.heading}>{e.bag.code}</Text>
                  <Text style={ui.muted}>
                    {new Date(e.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Fortaleza",
                    })}{" "}
                    · Lançamento: {e.actorName}
                  </Text>
                  <Text style={ui.muted}>
                    Equipe:{" "}
                    {e.participantSnapshot.map((p: any) => p.name).join(", ")}
                  </Text>
                  {e.outputs.map((o: any) => (
                    <Text key={o.id} style={ui.body}>
                      {o.materialName}: {kg(o.quantityKg)} · {o.lotCode}
                    </Text>
                  ))}
                  {Number(e.rejectedKg) > 0 && (
                    <Text>Rejeitos: {kg(e.rejectedKg)}</Text>
                  )}
                  <FieldButton
                    secondary
                    label={`Abrir bag ${e.bag.code}`}
                    onPress={() => openBag(e.bag.id)}
                  />
                </View>
              ))}
              {!d.events.items.length && (
                <Text style={ui.body}>Nenhuma pesagem neste detalhe.</Text>
              )}
              <View style={ui.row}>
                <FieldButton
                  secondary
                  label="Pesagens anteriores"
                  disabled={q.eventPage <= 1}
                  onPress={() =>
                    setQ((f) => ({ ...f, eventPage: f.eventPage - 1 }))
                  }
                />
                <Text>
                  {q.eventPage}/{d.events.pagination.totalPages}
                </Text>
                <FieldButton
                  secondary
                  label="Próximas pesagens"
                  disabled={q.eventPage >= d.events.pagination.totalPages}
                  onPress={() =>
                    setQ((f) => ({ ...f, eventPage: f.eventPage + 1 }))
                  }
                />
              </View>
            </View>
          )}
        </>
      )}
    </>
  );
}
