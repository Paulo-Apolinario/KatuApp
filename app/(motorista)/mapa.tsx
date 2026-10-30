import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/src/contexts/AuthContext";
import { useForegroundLocation } from "@/src/hooks/useForegroundLocation";
import { useConnectivity } from "@/src/hooks/useConnectivity";
import { MotoristaGreenHeader } from "@/src/components/MotoristaGreenHeader";
import { NotificationBell } from "@/src/components/NotificationBell";
import { LocationStatus } from "@/src/components/LocationStatus";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { LastSyncBadge } from "@/src/components/LastSyncBadge";
import OperationalMap from "@/src/components/maps/OperationalMap";
import type { OperationalMapPoint } from "@/src/components/maps/mapMarkers";
import { Action, Card, Notice } from "@/src/components/ui/Workspace";
import {
  routeService,
  translateRouteStatus,
  type RouteItem,
} from "@/src/services/routeService";
import {
  collectionService,
  translateCollectionStatus,
  type Collection,
} from "@/src/services/collectionService";
import {
  vehicleService,
  translateVehicleStatus,
  type Vehicle,
} from "@/src/services/vehicleService";
import {
  driverService,
  type DriverProfile,
} from "@/src/services/driverService";
import {
  collectionOrigin,
  validCoordinates,
} from "@/src/utils/collectionOrigin";
import {
  driverMapModel,
  orderedRouteVisits,
  type DriverMapScope,
} from "@/src/utils/driverMapModel";
const GPS_ID = "driver-current-location",
  SEDE_ID = "driver-cooperative";
export default function MotoristaMapaScreen() {
  const { user } = useAuth(),
    driverId = user?.driver?.id,
    gps = useForegroundLocation(),
    { isOffline } = useConnectivity(),
    params = useLocalSearchParams<{
      routeId?: string;
      collectionId?: string;
    }>();
  const [routes, setRoutes] = useState<RouteItem[]>([]),
    [route, setRoute] = useState<RouteItem | null>(null),
    [collections, setCollections] = useState<Collection[]>([]),
    [profile, setProfile] = useState<DriverProfile | null>(null),
    [vehicle, setVehicle] = useState<Vehicle | null>(null),
    [scope, setScope] = useState<DriverMapScope>("ROUTE"),
    [showFinished, setShowFinished] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [focus, setFocus] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [lastSync, setLastSync] = useState<string | null>(null);
  const request = useRef(0),
    owner = useRef(user?.id),
    selection = useRef({ routeId: route?.id, point: selected, scope });
  owner.current = user?.id;
  selection.current = { routeId: route?.id, point: selected, scope };
  const load = useCallback(async () => {
    const seq = ++request.current,
      uid = user?.id;
    setBusy(true);
    setError("");
    try {
      if (!driverId)
        throw Error("Motorista não vinculado ao usuário autenticado.");
      const [list, all, me, car] = await Promise.all([
        routeService.listActiveByDriver(driverId),
        collectionService.listByDriver(driverId),
        driverService.getMyProfile(),
        vehicleService.getCurrentByDriver(driverId),
      ]);
      const linkedRoute = params.collectionId
        ? all.find((c) => c.id === params.collectionId)?.routeId
        : null;
      const preferred =
          params.routeId || linkedRoute || selection.current.routeId,
        chosen =
          list.find((r) => r.id === preferred) ||
          list.find((r) => r.status === "IN_PROGRESS") ||
          list[0] ||
          null;
      let detail = chosen;
      if (params.routeId || linkedRoute)
        detail = await routeService.getById(
          String(params.routeId || linkedRoute),
        );
      else if (chosen) detail = await routeService.getById(chosen.id);
      if (seq !== request.current || uid !== owner.current) return;
      setRoutes(list);
      setCollections(all);
      setProfile(me);
      setVehicle(car);
      setRoute(detail);
      setLastSync(collectionService.getLastRemoteSyncAt());
      const highlight = params.collectionId
        ? String(params.collectionId)
        : selection.current.point;
      const candidates = [...(detail?.collections || []), ...all],
        point = candidates.find((c) => c.id === highlight);
      if (point) {
        setSelected(point.id);
        setShowFinished(!["PENDING", "IN_PROGRESS"].includes(point.status));
        if (!point.routeId) setScope("UNASSIGNED");
        else if (detail?.id !== point.routeId) setScope("ALL");
      } else setSelected(null);
      if (!detail && selection.current.scope === "ROUTE")
        setScope("UNASSIGNED");
    } catch (e: any) {
      if (seq === request.current && uid === owner.current)
        setError(
          e.message ||
            "Não foi possível carregar o mapa. Atualize para tentar novamente.",
        );
    } finally {
      if (seq === request.current && uid === owner.current) {
        setLoading(false);
        setBusy(false);
      }
    }
  }, [driverId, user?.id, params.routeId, params.collectionId]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        request.current++;
      };
    }, [load]),
  );
  useEffect(() => {
    const activeRequest = request;
    setRoutes([]);
    setRoute(null);
    setCollections([]);
    setProfile(null);
    setVehicle(null);
    setSelected(null);
    setLoading(true);
    return () => {
      activeRequest.current++;
    };
  }, [user?.id]);
  const model = useMemo(
    () => driverMapModel(route, collections, scope, showFinished),
    [route, collections, scope, showFinished],
  );
  const nextOrigin = collectionOrigin(model.next),
    nextIndex =
      route && model.next
        ? orderedRouteVisits(route).findIndex((c) => c.id === model.next?.id) +
          1
        : null;
  const points = useMemo<OperationalMapPoint[]>(() => {
    const list: OperationalMapPoint[] = [];
    if (gps.position)
      list.push({
        id: GPS_ID,
        title: "Motorista · posição deste aparelho",
        description: `Precisão aproximada ${gps.position.coords.accuracy == null ? "não informada" : Math.round(gps.position.coords.accuracy) + " m"}`,
        latitude: gps.position.coords.latitude,
        longitude: gps.position.coords.longitude,
        kind: "driver",
        includeInBounds: true,
      });
    const coop = profile?.cooperative;
    if (validCoordinates(coop?.latitude, coop?.longitude))
      list.push({
        id: SEDE_ID,
        title: `Sede · ${coop?.name || "Cooperativa"}`,
        description: coop?.address || "Sede da cooperativa",
        latitude: Number(coop?.latitude),
        longitude: Number(coop?.longitude),
        kind: "cooperative",
        includeInBounds: false,
      });
    if (scope === "ROUTE" && route) {
      for (const [key, p] of [
        ["start", route.startPoint],
        ["end", route.endPoint],
      ] as const)
        if (p && validCoordinates(p.latitude, p.longitude))
          list.push({
            id: `route-${key}`,
            title: `${key === "start" ? "Partida" : "Chegada"} · ${p.name}`,
            description: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
            kind: key,
          });
    }
    for (const stop of model.stops)
      if (stop.located) {
        const o = stop.origin!;
        list.push({
          id: stop.collection.id,
          title: `${stop.sequence ? `Parada ${stop.sequence} · ` : ""}${o.name}`,
          description: [
            translateCollectionStatus(stop.collection.status),
            o.address,
            scope === "ALL" ? stop.collection.route?.name || "Sem rota" : null,
          ]
            .filter(Boolean)
            .join(" · "),
          latitude: Number(o.latitude),
          longitude: Number(o.longitude),
          kind: stop.kind,
          sequence: stop.sequence,
          color:
            stop.collection.status === "IN_PROGRESS" ? "#7C3AED" : undefined,
        });
      }
    return list;
  }, [gps.position, profile, model, scope, route]);
  const visibleSelected = points.some((p) => p.id === selected)
    ? selected
    : null;
  const selectedStop = model.stops.find(
    (s) => s.collection.id === visibleSelected,
  );
  async function selectRoute(item: RouteItem) {
    if (busy) return;
    const seq = ++request.current,
      uid = owner.current;
    setBusy(true);
    setError("");
    try {
      const detail = await routeService.getById(item.id);
      if (seq !== request.current || uid !== owner.current) return;
      setRoute(detail);
      setScope("ROUTE");
      setShowFinished(false);
      setSelected(null);
      setFocus((n) => n + 1);
      router.setParams({ routeId: undefined, collectionId: undefined });
    } catch (e: any) {
      if (seq === request.current) setError(e.message || "Rota indisponível.");
    } finally {
      if (seq === request.current) setBusy(false);
    }
  }
  function changeScope(value: DriverMapScope) {
    setScope(value);
    setSelected(null);
    setShowFinished(false);
    setFocus((n) => n + 1);
  }
  function locate(id: string | null) {
    setSelected(id);
    setFocus((n) => n + 1);
  }
  async function navigate(c: Collection) {
    const o = collectionOrigin(c);
    if (!validCoordinates(o?.latitude, o?.longitude)) {
      setError(
        "Este ponto está sem localização confirmada. Solicite a correção à cooperativa.",
      );
      return;
    }
    try {
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${o!.latitude},${o!.longitude}&travelmode=driving`,
      );
    } catch {
      setError("Não foi possível abrir a navegação.");
    }
  }
  if (loading)
    return (
      <View style={s.loading}>
        <ActivityIndicator color="#047857" />
        <Text>Carregando mapa do motorista…</Text>
      </View>
    );
  return (
    <View style={s.page}>
      <MotoristaGreenHeader
        title="Mapa do motorista"
        subtitle="Sua rota, próxima parada e localização do aparelho"
        onBack={() => router.back()}
        rightAction={<NotificationBell />}
      />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={busy} onRefresh={() => void load()} />
        }
      >
        <OfflineBanner visible={isOffline} />
        <LastSyncBadge value={lastSync} />
        {!!error && <Notice error text={error} />}
        <Card>
          <Text style={s.title}>Roteiro em exibição</Text>
          <Text style={s.body}>
            {route?.name || "Nenhuma rota programada disponível"}
            {route ? ` · ${translateRouteStatus(route.status)}` : ""}
          </Text>
          <Text style={s.muted}>
            Veículo:{" "}
            {vehicle
              ? `${vehicle.plate} · ${vehicle.model || ""} · ${translateVehicleStatus(vehicle.status)}`
              : "Não vinculado"}
          </Text>
          {route && (
            <Text style={s.muted}>
              Rota:{" "}
              {route.scheduledDate
                ? new Date(route.scheduledDate).toLocaleString("pt-BR", {
                    timeZone: "America/Fortaleza",
                  })
                : "Data não informada"}{" "}
              · Veículo da rota: {route.vehicle?.plate || "Não vinculado"}
            </Text>
          )}
          <View style={s.row}>
            <Action
              label="Rota selecionada"
              secondary={scope !== "ROUTE"}
              disabled={!route || busy}
              onPress={() => changeScope("ROUTE")}
            />
            <Action
              label="Coletas sem rota"
              secondary={scope !== "UNASSIGNED"}
              disabled={busy}
              onPress={() => changeScope("UNASSIGNED")}
            />
            <Action
              label="Todas as rotas"
              secondary={scope !== "ALL"}
              disabled={busy}
              onPress={() => changeScope("ALL")}
            />
            <Action
              label="Recarregar"
              secondary
              busy={busy}
              onPress={() => void load()}
            />
          </View>
          <Text style={s.muted}>
            {scope === "ROUTE"
              ? "Números seguem a ordem definida pela cooperativa, incluindo posições já atendidas. A sede não é adicionada como parada automaticamente."
              : scope === "UNASSIGNED"
                ? "Somente coletas atribuídas a você que não possuem rota. Não há sequência otimizada neste modo."
                : "Visão geral das coletas atribuídas a você. Selecione uma rota para orientar a sequência de visitas."}
          </Text>
        </Card>
        <LocationStatus
          position={gps.position}
          error={gps.error}
          loading={gps.loading}
          retry={gps.retry}
          active={gps.active}
        />
        <Card>
          <Text style={s.title}>
            {scope === "ALL"
              ? "Orientação de visitas"
              : "Próxima parada pendente"}
          </Text>
          {model.next ? (
            <>
              <Text style={s.stop}>
                {scope === "ROUTE" && nextIndex ? `${nextIndex}. ` : ""}
                {nextOrigin?.name || "Ponto sem identificação"}
              </Text>
              <Text style={s.body}>
                {nextOrigin?.address || "Endereço não informado"}
              </Text>
              <Text style={s.muted}>
                {translateCollectionStatus(model.next.status)}
              </Text>
              <View style={s.row}>
                <Action
                  label="Localizar próxima parada"
                  secondary
                  disabled={
                    !validCoordinates(
                      nextOrigin?.latitude,
                      nextOrigin?.longitude,
                    )
                  }
                  onPress={() => locate(model.next!.id)}
                />
                <Action
                  label="Navegar até a próxima parada"
                  disabled={
                    !validCoordinates(
                      nextOrigin?.latitude,
                      nextOrigin?.longitude,
                    )
                  }
                  onPress={() => void navigate(model.next!)}
                />
              </View>
              {!validCoordinates(
                nextOrigin?.latitude,
                nextOrigin?.longitude,
              ) && (
                <Notice
                  error
                  text="A próxima parada não possui coordenadas confirmadas. A cooperativa precisa ajustar o endereço; ela não foi pulada na sequência."
                />
              )}
            </>
          ) : (
            <Notice
              text={
                scope === "ALL"
                  ? "Escolha uma rota ou as coletas sem rota para visualizar a próxima parada."
                  : "Não há visitas pendentes nesta seleção."
              }
            />
          )}
        </Card>
        <View style={s.map}>
          <OperationalMap
            baseLabel={null}
            baseLatitude={gps.position?.coords.latitude ?? -3.7319}
            baseLongitude={gps.position?.coords.longitude ?? -38.5267}
            points={points}
            selectedPointId={visibleSelected}
            onSelectPoint={(id) => setSelected(id === "__base__" ? null : id)}
            focusRequest={focus}
            showPointList
            accuracyCircle={
              gps.position &&
              Number.isFinite(gps.position.coords.accuracy) &&
              gps.position.coords.accuracy! > 0
                ? {
                    latitude: gps.position.coords.latitude,
                    longitude: gps.position.coords.longitude,
                    radius: gps.position.coords.accuracy!,
                  }
                : undefined
            }
          />
        </View>
        <View style={s.row}>
          <Action
            label="Enquadrar pontos desta visão"
            secondary
            onPress={() => locate(null)}
          />
          <Action
            label="Minha posição"
            secondary
            disabled={!gps.position}
            onPress={() => locate(GPS_ID)}
          />
          <Action
            label="Localizar sede"
            secondary
            disabled={!points.some((p) => p.id === SEDE_ID)}
            onPress={() => locate(SEDE_ID)}
          />
          <Action
            label={
              showFinished
                ? "Ocultar visitas atendidas"
                : "Exibir visitas atendidas"
            }
            secondary
            onPress={() => {
              setShowFinished(!showFinished);
              setSelected(null);
            }}
          />
        </View>
        {!!model.missing && (
          <Notice
            error
            text={`${model.missing} ponto(s) desta seleção sem coordenadas confirmadas. Eles continuam na lista de visitas abaixo.`}
          />
        )}
        <Notice text="O mapa apresenta os pontos e a ordem do roteiro. O percurso pelas ruas é aberto em Navegar; não são desenhadas ligações diretas como se fossem trajeto viário." />
        {route?.fromCache && scope === "ROUTE" && (
          <Notice text="Roteiro salvo no aparelho. Reconecte e recarregue para conferir alterações da cooperativa." />
        )}
        {selectedStop && (
          <Card>
            <Text style={s.title}>Visita selecionada</Text>
            <Text style={s.body}>{selectedStop.origin?.name}</Text>
            <Text style={s.muted}>{selectedStop.origin?.address}</Text>
            <Action
              label="Navegar para o ponto selecionado"
              disabled={!selectedStop.located}
              onPress={() => void navigate(selectedStop.collection)}
            />
          </Card>
        )}
        <Card>
          <Text style={s.title}>
            Visitas desta seleção · {model.stops.length}
          </Text>
          <Text style={s.muted}>
            {model.pending.length} pendente(s) · {model.finished} atendida(s)
          </Text>
          {model.stops.map((stop) => (
            <View key={stop.collection.id} style={s.visit}>
              <Text style={s.body}>
                {stop.sequence ? `${stop.sequence}. ` : ""}
                {stop.origin?.name || "Ponto de coleta"}
                {stop.kind === "pev" ? " · PEV" : ""}
              </Text>
              <Text style={s.muted}>
                {stop.origin?.address || "Endereço não informado"} ·{" "}
                {translateCollectionStatus(stop.collection.status)}
              </Text>
              {!stop.located ? (
                <Text style={s.warning}>Sem localização confirmada</Text>
              ) : (
                <Action
                  label={`Localizar visita ${stop.sequence || stop.origin?.name || stop.collection.id}`}
                  secondary
                  onPress={() => locate(stop.collection.id)}
                />
              )}
            </View>
          ))}
        </Card>
        <Card>
          <Text style={s.title}>Escolher rota</Text>
          {routes.length ? (
            routes.map((item) => (
              <Action
                key={item.id}
                label={`${item.id === route?.id ? "✓ " : ""}${item.name} · ${translateRouteStatus(item.status)}`}
                secondary={item.id !== route?.id}
                disabled={busy}
                onPress={() => void selectRoute(item)}
              />
            ))
          ) : (
            <Notice text="Nenhuma rota programada ou em andamento atribuída a você." />
          )}
          {route && (
            <Action
              label="Abrir execução desta rota"
              secondary
              onPress={() =>
                router.push({
                  pathname: "/(motorista)/rotas",
                  params: { highlightRouteId: route.id },
                })
              }
            />
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F8F6" },
  content: {
    padding: 16,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#163F33" },
  body: { fontSize: 15, lineHeight: 23, color: "#244D3F" },
  stop: { fontSize: 20, lineHeight: 27, fontWeight: "700", color: "#0D4937" },
  muted: { fontSize: 13, lineHeight: 21, color: "#63786D" },
  warning: { fontSize: 13, color: "#9A5A12" },
  map: {
    borderWidth: 1,
    borderColor: "#DCE7DF",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "white",
    marginBottom: 12,
  },
  visit: {
    borderTopWidth: 1,
    borderColor: "#E1EAE4",
    paddingTop: 12,
    marginTop: 10,
  },
});
