import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  Linking,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import {
  routeService,
  type RouteItem,
  translateRouteStatus,
} from "@/src/services/routeService";
import { translateCollectionStatus } from "@/src/services/collectionService";
import { translateVehicleStatus } from "@/src/services/vehicleService";
import { MotoristaGreenHeader } from "@/src/components/MotoristaGreenHeader";

function openExternalNavigation(params: {
  latitude: number;
  longitude: number;
  originLatitude?: number | null;
  originLongitude?: number | null;
}) {
  const destination = `${params.latitude},${params.longitude}`;
  const origin =
    params.originLatitude != null && params.originLongitude != null
      ? `&origin=${params.originLatitude},${params.originLongitude}`
      : "";

  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}${origin}&travelmode=driving`;
  return Linking.openURL(url);
}

type RouteWithDetail = RouteItem & {
  detail: RouteItem;
  calendarDate: Date | null;
};

type CalendarDay = {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
};

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getWeekdayLabels() {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
}

function getRouteBaseDate(route: RouteItem): Date | null {
  if (route.scheduledDate) {
    const parsed = new Date(route.scheduledDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const collectionDate =
    route.collections?.[0]?.schedule?.scheduledDate ||
    route.collections?.[0]?.schedule?.preferredDate ||
    null;

  if (collectionDate) {
    const parsed = new Date(collectionDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function buildMonthGrid(referenceDate: Date): CalendarDay[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const start = new Date(firstDayOfMonth);
  start.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

  const end = new Date(lastDayOfMonth);
  end.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()));

  const days: CalendarDay[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
      date: new Date(cursor),
      inCurrentMonth: cursor.getMonth() === month,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <Text style={{ color: "#6B7280", marginTop: 6, lineHeight: 21 }}>
      {label}: {value || "Não informado"}
    </Text>
  );
}

function StatusBadge({ label }: { label: string }) {
  const isInProgress = label === "IN_PROGRESS";
  const isCompleted = label === "COMPLETED";
  const isCancelled = label === "CANCELLED";

  const backgroundColor = isInProgress
    ? "#FEF3C7"
    : isCompleted
    ? "#DCFCE7"
    : isCancelled
    ? "#FEE2E2"
    : "#ECFDF5";

  const textColor = isInProgress
    ? "#B45309"
    : isCompleted
    ? "#166534"
    : isCancelled
    ? "#B91C1C"
    : "#047857";

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        marginTop: 10,
      }}
    >
      <Text style={{ color: textColor, fontSize: 12, fontWeight: "700" }}>
        {translateRouteStatus(label)}
      </Text>
    </View>
  );
}

export default function MotoristaCalendarioScreen() {
  const { user } = useAuth();
  const driverId = user?.driver?.id ?? null;

  const today = useMemo(() => normalizeDate(new Date()), []);
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [detailsById, setDetailsById] = useState<Record<string, RouteItem>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = useCallback(
    async (showRefresh = false) => {
      if (!driverId) {
        setError("Motorista não vinculado ao usuário autenticado.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setError(null);

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await routeService.listByDriver(driverId);
        setRoutes(data);
      } catch (err: any) {
        setError(err?.message || "Não foi possível carregar o calendário.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [driverId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadRoutes();
    }, [loadRoutes])
  );

  const routeItems = useMemo<RouteWithDetail[]>(
    () =>
      routes
        .map((item) => ({
          ...item,
          detail: detailsById[item.id] ?? item,
          calendarDate: getRouteBaseDate(item),
        }))
        .sort((a, b) => {
          const aTime = a.calendarDate ? a.calendarDate.getTime() : 0;
          const bTime = b.calendarDate ? b.calendarDate.getTime() : 0;
          return aTime - bTime;
        }),
    [detailsById, routes]
  );

  const monthGrid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  const routesByDayMap = useMemo(() => {
    const map = new Map<string, RouteWithDetail[]>();

    routeItems.forEach((route) => {
      if (!route.calendarDate) return;

      const key = normalizeDate(route.calendarDate).toISOString();
      const current = map.get(key) ?? [];
      current.push(route);
      map.set(key, current);
    });

    return map;
  }, [routeItems]);

  const selectedDayKey = normalizeDate(selectedDate).toISOString();

  const selectedRoutes = useMemo(() => {
    return routesByDayMap.get(selectedDayKey) ?? [];
  }, [routesByDayMap, selectedDayKey]);

  const monthSummary = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    const monthRoutes = routeItems.filter((route) => {
      return (
        route.calendarDate &&
        route.calendarDate.getMonth() === month &&
        route.calendarDate.getFullYear() === year
      );
    });

    const totalCollections = monthRoutes.reduce((acc, route) => {
      return acc + (route.detail.collections?.length || route.collections?.length || 0);
    }, 0);

    const activeDays = new Set(
      monthRoutes
        .filter((route) => route.calendarDate)
        .map((route) => normalizeDate(route.calendarDate!).toISOString())
    ).size;

    return {
      totalRoutes: monthRoutes.length,
      totalCollections,
      activeDays,
    };
  }, [currentMonth, routeItems]);

  const handleToggleRoute = useCallback(
    async (routeId: string) => {
      if (expandedId === routeId) {
        setExpandedId(null);
        return;
      }

      setExpandedId(routeId);

      if (!detailsById[routeId]) {
        try {
          const detail = await routeService.getById(routeId);
          setDetailsById((prev) => ({ ...prev, [routeId]: detail }));
        } catch (err: any) {
          setError(err?.message || "Não foi possível carregar os detalhes da rota.");
        }
      }
    },
    [detailsById, expandedId]
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFC",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#4B5563", fontWeight: "600" }}>
          Carregando calendário...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <MotoristaGreenHeader
        title="Calendário"
        subtitle="Agenda operacional do motorista"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: 30,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRoutes(true)}
            colors={["#028C56"]}
            tintColor="#028C56"
          />
        }
      >
        {!!error && (
          <View
            style={{
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#B91C1C", fontWeight: "700" }}>{error}</Text>
          </View>
        )}

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <TouchableOpacity
              onPress={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                    1
                  )
                )
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#F0FDF4",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#028C56" />
            </TouchableOpacity>

            <Text
              style={{
                color: "#111827",
                fontSize: 18,
                fontWeight: "800",
                textTransform: "capitalize",
              }}
            >
              {getMonthLabel(currentMonth)}
            </Text>

            <TouchableOpacity
              onPress={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    1
                  )
                )
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#F0FDF4",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-forward" size={20} color="#028C56" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            {getWeekdayLabels().map((label) => (
              <View
                key={label}
                style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
              >
                <Text
                  style={{
                    color: "#6B7280",
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {monthGrid.map((day) => {
              const normalized = normalizeDate(day.date);
              const key = normalized.toISOString();
              const hasRoutes = (routesByDayMap.get(key) ?? []).length > 0;
              const isSelected = isSameDay(normalized, selectedDate);
              const isToday = isSameDay(normalized, today);

              return (
                <TouchableOpacity
                  key={day.key}
                  activeOpacity={0.9}
                  onPress={() => setSelectedDate(normalized)}
                  style={{
                    width: "14.285%",
                    padding: 4,
                  }}
                >
                  <View
                    style={{
                      minHeight: 56,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected
                        ? "#028C56"
                        : isToday
                        ? "#86EFAC"
                        : "#E5E7EB",
                      backgroundColor: isSelected
                        ? "#ECFDF5"
                        : day.inCurrentMonth
                        ? "#FFFFFF"
                        : "#F8FAFC",
                      opacity: day.inCurrentMonth ? 1 : 0.6,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#065F46" : "#111827",
                        fontWeight: isSelected ? "800" : "700",
                        fontSize: 15,
                      }}
                    >
                      {day.date.getDate()}
                    </Text>

                    {hasRoutes && (
                      <View
                        style={{
                          marginTop: 5,
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          backgroundColor: "#028C56",
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: "31%",
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "700" }}>
              ROTAS
            </Text>
            <Text
              style={{
                color: "#111827",
                fontSize: 22,
                fontWeight: "800",
                marginTop: 8,
              }}
            >
              {monthSummary.totalRoutes}
            </Text>
          </View>

          <View
            style={{
              width: "31%",
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "700" }}>
              COLETAS
            </Text>
            <Text
              style={{
                color: "#111827",
                fontSize: 22,
                fontWeight: "800",
                marginTop: 8,
              }}
            >
              {monthSummary.totalCollections}
            </Text>
          </View>

          <View
            style={{
              width: "31%",
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 11, fontWeight: "700" }}>
              DIAS ATIVOS
            </Text>
            <Text
              style={{
                color: "#111827",
                fontSize: 22,
                fontWeight: "800",
                marginTop: 8,
              }}
            >
              {monthSummary.activeDays}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#111827", fontSize: 17, fontWeight: "800" }}>
            Agenda do dia
          </Text>

          <Text style={{ color: "#6B7280", marginTop: 8, lineHeight: 22 }}>
            {selectedDate.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </Text>

          <Text style={{ color: "#6B7280", marginTop: 10 }}>
            Rotas do dia: {selectedRoutes.length}
          </Text>
        </View>

        {selectedRoutes.length === 0 ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
              Nenhuma rota neste dia
            </Text>
            <Text style={{ color: "#6B7280", marginTop: 10, lineHeight: 22 }}>
              Selecione outro dia marcado no calendário para ver as rotas atribuídas.
            </Text>
          </View>
        ) : (
          selectedRoutes.map((routeEntry) => {
            const { detail, ...item } = routeEntry;
            const isExpanded = expandedId === item.id;

            const firstPoint =
              detail.collections?.find(
                (collection) =>
                  collection.generator?.latitude != null &&
                  collection.generator?.longitude != null
              )?.generator || null;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.95}
                onPress={() => void handleToggleRoute(item.id)}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: "#111827", fontSize: 17, fontWeight: "800" }}>
                      {item.name}
                    </Text>

                    {!!item.description && (
                      <Text style={{ color: "#6B7280", marginTop: 8 }}>
                        {item.description}
                      </Text>
                    )}

                    <DetailLine
                      label="Data"
                      value={
                        item.scheduledDate
                          ? new Date(item.scheduledDate).toLocaleString("pt-BR")
                          : "Não definida"
                      }
                    />
                    <DetailLine label="Paradas" value={item.stops?.length || 0} />
                    <DetailLine
                      label="Coletas"
                      value={
                        item.stats?.totalCollections ??
                        detail.collections?.length ??
                        0
                      }
                    />
                    {!!item.vehicle?.plate && (
                      <DetailLine label="Veículo" value={item.vehicle.plate} />
                    )}

                    <StatusBadge label={item.status} />
                  </View>

                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={22}
                    color="#6B7280"
                  />
                </View>

                {isExpanded && (
                  <View
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTopWidth: 1,
                      borderTopColor: "#E5E7EB",
                    }}
                  >
                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 15,
                        fontWeight: "800",
                        marginBottom: 10,
                      }}
                    >
                      Informações da rota
                    </Text>

                    <DetailLine
                      label="Situação do veículo"
                      value={translateVehicleStatus(detail.vehicle?.status)}
                    />
                    <DetailLine
                      label="Motorista"
                      value={detail.driver?.name || user?.displayName}
                    />
                    <DetailLine
                      label="Cooperativa"
                      value={detail.cooperative?.name}
                    />

                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 14,
                        fontWeight: "800",
                        marginTop: 14,
                        marginBottom: 8,
                      }}
                    >
                      Pontos / paradas
                    </Text>

                    {(detail.stops || []).length > 0 ? (
                      detail.stops.map((stop, index) => (
                        <Text
                          key={`${detail.id}-stop-${index}`}
                          style={{ color: "#6B7280", lineHeight: 22 }}
                        >
                          {index + 1}. {stop}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: "#6B7280" }}>
                        Nenhuma parada cadastrada.
                      </Text>
                    )}

                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 14,
                        fontWeight: "800",
                        marginTop: 14,
                        marginBottom: 8,
                      }}
                    >
                      Coletas / agendamentos
                    </Text>

                    {(detail.collections || []).length > 0 ? (
                      detail.collections!.map((collection) => (
                        <View
                          key={collection.id}
                          style={{
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                            borderRadius: 14,
                            padding: 12,
                            marginBottom: 10,
                            backgroundColor: "#F9FAFB",
                          }}
                        >
                          <Text
                            style={{
                              color: "#111827",
                              fontWeight: "800",
                              marginBottom: 4,
                            }}
                          >
                            {collection.generator?.companyName ||
                              collection.generator?.name ||
                              "Ponto de coleta"}
                          </Text>
                          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
                            Status: {translateCollectionStatus(collection.status)}
                          </Text>
                          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
                            Endereço: {collection.generator?.address || "Não informado"}
                          </Text>
                          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
                            Data:{" "}
                            {collection.schedule?.scheduledDate ||
                            collection.schedule?.preferredDate
                              ? new Date(
                                  collection.schedule?.scheduledDate ||
                                    collection.schedule?.preferredDate ||
                                    ""
                                ).toLocaleString("pt-BR")
                              : "Não definida"}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: "#6B7280" }}>
                        Nenhuma coleta carregada nesta rota.
                      </Text>
                    )}

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 10,
                        marginTop: 12,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/(motorista)/mapa",
                            params: { routeId: item.id },
                          })
                        }
                        style={{
                          backgroundColor: "#ECFDF5",
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: "#047857", fontWeight: "800" }}>
                          VER NO MAPA
                        </Text>
                      </TouchableOpacity>

                      {firstPoint?.latitude != null &&
                        firstPoint?.longitude != null && (
                          <TouchableOpacity
                            onPress={() =>
                              openExternalNavigation({
                                latitude: Number(firstPoint.latitude),
                                longitude: Number(firstPoint.longitude),
                              })
                            }
                            style={{
                              backgroundColor: "#028C56",
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 12,
                            }}
                          >
                            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                              TRAÇAR ROTA
                            </Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}