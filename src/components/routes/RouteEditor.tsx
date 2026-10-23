import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Workspace, Card, Field, Action, Notice } from "../ui/Workspace";
import OperationalMap from "../maps/OperationalMap";
import { routeService, type RouteItem } from "../../services/routeService";
import { driverService, type Driver } from "../../services/driverService";
import { vehicleService, type Vehicle } from "../../services/vehicleService";
import type { Collection } from "../../types/collection";
import {
  collectionOrigin,
  validCoordinates,
} from "../../utils/collectionOrigin";
import { materialQuantity } from "../../utils/materials";
import { parseFortalezaDateTime } from "../../utils/dateTime";
import { useAuth } from "../../contexts/AuthContext";
export default function RouteEditor({ routeId }: { routeId?: string }) {
  const { user } = useAuth();
  const guard = useRef(false);
  const [name, setName] = useState(""),
    [date, setDate] = useState(""),
    [description, setDescription] = useState(""),
    [driverId, setDriverId] = useState(""),
    [vehicleId, setVehicleId] = useState(""),
    [stops, setStops] = useState(""),
    [search, setSearch] = useState("");
  const [ids, setIds] = useState<string[]>([]),
    [collections, setCollections] = useState<Collection[]>([]),
    [drivers, setDrivers] = useState<Driver[]>([]),
    [vehicles, setVehicles] = useState<Vehicle[]>([]),
    [routes, setRoutes] = useState<RouteItem[]>([]),
    [current, setCurrent] = useState<RouteItem | null>(null);
  const [visible, setVisible] = useState(30);
  const [loadFailed, setLoadFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const [available, ds, vs, rs, route] = await Promise.all([
        routeService.listAvailableCollections(),
        driverService.list(),
        vehicleService.list(),
        routeService.list(),
        routeId ? routeService.getById(routeId) : Promise.resolve(null),
      ]);
      setDrivers(ds);
      setVehicles(vs);
      setRoutes(rs);
      setCurrent(route);
      setCollections([
        ...new Map(
          [...(route?.collections || []), ...available].map((c) => [c.id, c]),
        ).values(),
      ]);
      if (route) {
        setName(route.name);
        setDate(
          route.scheduledDate
            ? new Date(route.scheduledDate).toLocaleDateString("pt-BR", {
                timeZone: "America/Fortaleza",
              })
            : "",
        );
        setDescription(route.description || "");
        setDriverId(route.driverId || "");
        setVehicleId(route.vehicleId || "");
        setStops(route.stops.join("\n"));
        setIds(
          route.collectionOrder?.length
            ? route.collectionOrder
            : (route.collections || []).map((c) => c.id),
        );
      }
    } catch (e: any) {
      setLoadFailed(true);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [routeId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const selected = ids
      .map((id) => collections.find((c) => c.id === id))
      .filter((c): c is Collection => !!c),
    terminal = (c: Collection) =>
      !["PENDING", "IN_PROGRESS"].includes(c.status);
  const points = selected.flatMap((c, index) => {
    const o = collectionOrigin(c);
    return o && validCoordinates(o.latitude, o.longitude)
      ? [
          {
            id: c.id,
            latitude: Number(o.latitude),
            longitude: Number(o.longitude),
            title: `${index + 1}. ${o.name}`,
            description: o.address,
          },
        ]
      : [];
  });
  const vehicle = vehicles.find((v) => v.id === vehicleId),
    blocked = current && ["COMPLETED", "CANCELLED"].includes(current.status);
  const conflicts = routes.filter(
    (r) =>
      r.id !== routeId &&
      !["COMPLETED", "CANCELLED"].includes(r.status) &&
      r.scheduledDate &&
      new Date(r.scheduledDate).toLocaleDateString("pt-BR", {
        timeZone: "America/Fortaleza",
      }) === date &&
      ((driverId && r.driverId === driverId) ||
        (vehicleId && r.vehicleId === vehicleId)),
  );
  const filtered = useMemo(
    () =>
      collections.filter(
        (c) =>
          !ids.includes(c.id) &&
          ["PENDING", "IN_PROGRESS"].includes(c.status) &&
          `${collectionOrigin(c)?.name} ${collectionOrigin(c)?.address} ${c.id}`
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR")),
      ),
    [collections, ids, search],
  );
  function move(index: number, delta: number) {
    setIds((old) => {
      const next = [...old];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
  async function save() {
    if (guard.current || blocked) return;
    setError("");
    if (name.trim().length < 2) {
      setError("Informe um nome com pelo menos dois caracteres.");
      return;
    }
    if (date && !parseFortalezaDateTime(date, "12:00")) {
      setError("Informe uma data válida no formato DD/MM/AAAA.");
      return;
    }
    if (vehicle && vehicle.status !== "ACTIVE") {
      setError("Selecione um veículo ativo.");
      return;
    }
    if (vehicle?.driverId && driverId && vehicle.driverId !== driverId) {
      setError("O veículo está vinculado a outro motorista.");
      return;
    }
    guard.current = true;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        scheduledDate: date || undefined,
        description: description.trim(),
        driverId: driverId || undefined,
        vehicleId: vehicleId || undefined,
        stops: stops
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        collectionIds: ids,
      };
      const result = routeId
        ? await routeService.update(routeId, {
            ...payload,
            driverId: driverId || null,
            vehicleId: vehicleId || null,
            scheduledDate: date || null,
          })
        : await routeService.create(payload);
      router.replace({
        pathname: "/(cooperativa)/rotas/[id]",
        params: { id: result.id },
      });
    } catch (e: any) {
      setError(
        `${e.message} Confira a lista antes de reenviar se a conexão caiu.`,
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  const coop = (user as any)?.cooperative;
  const locked = busy || !!blocked;
  return (
    <Workspace
      title={routeId ? "Planejar rota" : "Nova rota"}
      subtitle="Organize as coletas reais na sequência de visita. O salvamento mantém as coletas vinculadas à equipe e à rota."
    >
      {loading ? (
        <Notice text="Carregando recursos e coletas…" />
      ) : loadFailed ? (
        <Card>
          <Notice error text={error} />
          <Action
            secondary
            disabled={locked}
            label="Tentar carregar planejamento"
            onPress={() => void load()}
          />
        </Card>
      ) : (
        <>
          <Card>
            <Field
              editable={!locked}
              label="Nome da rota"
              value={name}
              onChangeText={setName}
              maxLength={120}
            />
            <Field
              editable={!locked}
              label="Data (DD/MM/AAAA, opcional no planejamento)"
              value={date}
              onChangeText={setDate}
              maxLength={10}
            />
            <Field
              editable={!locked}
              label="Descrição"
              value={description}
              onChangeText={setDescription}
              maxLength={3000}
              multiline
            />
            <Notice text="Defina motorista, veículo e data antes de iniciar a execução." />
            <Text style={{ fontWeight: "700" }}>Motorista</Text>
            <Action
              secondary
              disabled={locked}
              label="Definir motorista depois"
              onPress={() => setDriverId("")}
            />
            {drivers
              .filter((d) => d.status !== "INACTIVE")
              .map((d) => (
                <Action
                  key={d.id}
                  secondary={driverId !== d.id}
                  label={d.name}
                  onPress={() => setDriverId(d.id)}
                />
              ))}
            <Text style={{ fontWeight: "700" }}>Veículo</Text>
            <Action
              secondary
              disabled={locked}
              label="Definir veículo depois"
              onPress={() => setVehicleId("")}
            />
            {vehicles
              .filter((v) => v.status === "ACTIVE")
              .map((v) => (
                <Action
                  key={v.id}
                  secondary={vehicleId !== v.id}
                  label={`${v.plate} · ${v.model}`}
                  onPress={() => {
                    setVehicleId(v.id);
                    if (v.driverId) setDriverId(v.driverId);
                  }}
                />
              ))}
            {vehicle?.capacityKg != null && (
              <Notice
                text={`Capacidade cadastrada: ${vehicle.capacityKg} kg. O roteiro não calcula ocupação sem pesos compatíveis.`}
              />
            )}{" "}
            {!!conflicts.length && (
              <Notice
                text={`Revise os recursos: ${conflicts.length} outra(s) rota(s) na mesma data usam motorista ou veículo selecionado. A data, sozinha, não define conflito de horário.`}
              />
            )}
          </Card>
          <Card>
            <Text style={{ fontWeight: "700" }}>
              Sequência de visitas · {selected.length}
            </Text>
            {selected.map((c, index) => {
              const o = collectionOrigin(c);
              return (
                <View
                  key={c.id}
                  style={{
                    padding: 12,
                    backgroundColor: "#F8FAFC",
                    borderRadius: 10,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontWeight: "700" }}>
                    {index + 1}. {o?.name || `Coleta ${c.id.slice(-8)}`}
                  </Text>
                  <Text>{o?.address || "Endereço não informado"}</Text>
                  <Text>Catador: {c.collector?.name || "Não informado"}</Text>
                  {c.materials.map((m, i) => (
                    <Text key={i}>
                      {m.name || m.type}: {materialQuantity(m)}
                    </Text>
                  ))}
                  {!validCoordinates(o?.latitude, o?.longitude) && (
                    <Notice text="Sem coordenadas confirmadas. Corrija o endereço antes da execução." />
                  )}
                  <View
                    style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                  >
                    <Action
                      secondary
                      disabled={locked || index === 0 || terminal(c)}
                      label="Subir"
                      onPress={() => move(index, -1)}
                    />
                    <Action
                      secondary
                      disabled={
                        locked || index === selected.length - 1 || terminal(c)
                      }
                      label="Descer"
                      onPress={() => move(index, 1)}
                    />
                    <Action
                      secondary
                      disabled={locked || terminal(c)}
                      label="Remover"
                      onPress={() =>
                        setIds((old) => old.filter((id) => id !== c.id))
                      }
                    />
                  </View>
                  {terminal(c) && (
                    <Notice text="Histórico de execução preservado." />
                  )}
                </View>
              );
            })}
            <Field
              editable={!locked}
              label="Buscar coletas disponíveis por origem, endereço ou protocolo"
              value={search}
              onChangeText={setSearch}
            />
            {filtered.slice(0, visible).map((c) => (
              <Pressable
                disabled={locked}
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`Adicionar coleta ${collectionOrigin(c)?.name || c.id}`}
                onPress={() => setIds((old) => [...old, c.id])}
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  borderRadius: 8,
                }}
              >
                <Text>+ {collectionOrigin(c)?.name || c.id.slice(-8)}</Text>
                <Text>{collectionOrigin(c)?.address}</Text>
              </Pressable>
            ))}
            {filtered.length > visible && (
              <Action
                secondary
                disabled={locked}
                label="Mostrar mais coletas"
                onPress={() => setVisible((v) => v + 30)}
              />
            )}{" "}
            {!filtered.length && (
              <Notice text="Nenhuma outra coleta disponível para os filtros." />
            )}
          </Card>
          <Card>
            <Text style={{ fontWeight: "700" }}>Mapa do planejamento</Text>
            <OperationalMap
              baseLabel={
                validCoordinates(coop?.latitude, coop?.longitude)
                  ? "Sede da cooperativa"
                  : null
              }
              baseLatitude={
                validCoordinates(coop?.latitude, coop?.longitude)
                  ? Number(coop.latitude)
                  : (points[0]?.latitude ?? -3.7319)
              }
              baseLongitude={
                validCoordinates(coop?.latitude, coop?.longitude)
                  ? Number(coop.longitude)
                  : (points[0]?.longitude ?? -38.5267)
              }
              points={points}
              routeCoordinates={points.length === selected.length ? points : []}
            />
            <Notice text="A linha pontilhada representa a sequência, sem cálculo de distância ou tempo viário." />
          </Card>
          <Card>
            <Field
              editable={!locked}
              label="Referências textuais adicionais (uma por linha)"
              value={stops}
              onChangeText={setStops}
              multiline
              maxLength={50000}
            />
            <Notice text="Referências não substituem o vínculo das coletas acima. Paradas de rotas antigas são preservadas." />
            {!!error && <Notice error text={error} />}
            <Action
              label="Salvar planejamento"
              disabled={!!blocked}
              busy={busy}
              onPress={() => void save()}
            />
            {blocked && (
              <Notice text="Rota encerrada: planejamento disponível apenas para consulta." />
            )}
          </Card>
        </>
      )}
      {loading && !!error && (
        <>
          <Notice error text={error} />
          <Action
            secondary
            disabled={locked}
            label="Tentar novamente"
            onPress={() => void load()}
          />
        </>
      )}
    </Workspace>
  );
}
