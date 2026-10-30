import type { RouteItem } from "../services/routeService";
export function routeStartIssues(route: RouteItem): string[] {
  const issues: string[] = [];
  if (
    !route.scheduledDate ||
    !Number.isFinite(new Date(route.scheduledDate).getTime())
  )
    issues.push("Definir a data da execução");
  if (!route.driverId) issues.push("Designar o motorista");
  else if (route.driver?.status === "INACTIVE")
    issues.push("Substituir o motorista inativo");
  if (!route.vehicleId) issues.push("Designar o veículo");
  else if (route.vehicle?.status && route.vehicle.status !== "ACTIVE")
    issues.push("Disponibilizar um veículo ativo, fora de manutenção");
  if (
    !(route.collections || []).some(
      (c) => c.status === "PENDING" || c.status === "IN_PROGRESS",
    )
  )
    issues.push("Revisar os pontos: não há coleta pendente ou em andamento");
  return issues;
}
export function initialRouteId(
  routes: RouteItem[],
  now = new Date(),
): string | undefined {
  const key = (value: string | Date) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Fortaleza",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(new Date(value))
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const active = routes.find((r) => r.status === "IN_PROGRESS");
  if (active) return active.id;
  const today = key(now);
  const scheduled = routes
    .filter(
      (r) =>
        r.status === "SCHEDULED" &&
        r.scheduledDate &&
        Number.isFinite(new Date(r.scheduledDate).getTime()),
    )
    .sort((a, b) => +new Date(a.scheduledDate!) - +new Date(b.scheduledDate!));
  return (
    scheduled.find((r) => key(r.scheduledDate!) >= today)?.id ||
    scheduled.at(-1)?.id ||
    routes.find((r) => r.status === "SCHEDULED")?.id
  );
}
