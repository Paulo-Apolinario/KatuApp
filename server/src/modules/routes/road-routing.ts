import { z } from "zod";
import { optimizeSchema } from "./planning.schemas";
type Input = z.infer<typeof optimizeSchema>;
export function suggestSequence(matrix: number[][], count: number) {
  const score = (order: number[]) => {
    const path = [0, ...order, count + 1];
    return path.slice(0, -1).reduce((n, p, i) => n + matrix[p][path[i + 1]], 0);
  };
  const pending = new Set(Array.from({ length: count }, (_, i) => i + 1)),
    order: number[] = [];
  let last = 0;
  while (pending.size) {
    const next = [...pending].sort(
      (a, b) => matrix[last][a] - matrix[last][b] || a - b,
    )[0];
    order.push(next);
    pending.delete(next);
    last = next;
  }
  let best = score(order);
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < count - 1; i++)
      for (let j = i + 1; j < count; j++) {
        const next = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ];
        const cost = score(next);
        if (cost + 0.01 < best) {
          order.splice(0, count, ...next);
          best = cost;
          changed = true;
        }
      }
    if (!changed) break;
  }
  const original = Array.from({ length: count }, (_, i) => i + 1);
  return score(original) <= best ? original : order;
}
export async function optimizeRoad(input: Input) {
  const base = (
    process.env.ROUTING_OSRM_URL || "https://router.project-osrm.org"
  ).replace(/\/$/, "");
  if (base === "disabled")
    throw Error("Roteamento desativado. A ordem manual continua disponível.");
  const profile = process.env.ROUTING_OSRM_PROFILE || "driving";
  if (!/^[a-zA-Z0-9_-]+$/.test(profile))
    throw Error("Perfil de roteamento inválido.");
  const all = [input.start, ...input.points, input.end];
  const coords = (points: typeof all) =>
    points.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const read = async (path: string) => {
    let res: Response;
    try {
      res = await fetch(`${base}/${path}`, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
    } catch {
      throw Error(
        "Serviço de ruas indisponível. Mantenha a ordem manual ou tente novamente.",
      );
    }
    if (!res.ok)
      throw Error(
        "O serviço de ruas recusou o cálculo. Tente novamente mais tarde.",
      );
    const value = (await res.json()) as any;
    if (value.code !== "Ok")
      throw Error(
        "Não foi possível encontrar percurso por ruas para todos os pontos.",
      );
    return value;
  };
  const table = await read(
    `table/v1/${profile}/${coords(all)}?annotations=distance,duration`,
  );
  const n = all.length;
  if (
    !Array.isArray(table.distances) ||
    table.distances.length !== n ||
    table.distances.some(
      (r: any) =>
        !Array.isArray(r) ||
        r.length !== n ||
        r.some(
          (v: any) => typeof v !== "number" || !Number.isFinite(v) || v < 0,
        ),
    )
  )
    throw Error("Há pontos sem ligação rodoviária. Revise os endereços.");
  const order = suggestSequence(table.distances, input.points.length);
  const points = order.map((i) => input.points[i - 1]);
  const route = await read(
    `route/v1/${profile}/${coords([input.start, ...points, input.end])}?overview=full&geometries=geojson&steps=false`,
  );
  const r = route.routes?.[0];
  if (
    !r ||
    !Number.isFinite(r.distance) ||
    !Number.isFinite(r.duration) ||
    r.geometry?.type !== "LineString" ||
    !Array.isArray(r.geometry.coordinates) ||
    r.geometry.coordinates.length > 100000 ||
    r.geometry.coordinates.some(
      (p: any) =>
        !Array.isArray(p) ||
        p.length < 2 ||
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 90,
    )
  )
    throw Error("Percurso inválido retornado pelo serviço.");
  if (route.waypoints?.some((w: any) => w.distance > 500))
    throw Error(
      "Um ponto está a mais de 500 m da via encontrada. Confira o marcador no mapa.",
    );
  return {
    points,
    distanceMeters: r.distance,
    durationSeconds: r.duration,
    geometry: r.geometry,
    provider: new URL(base).hostname,
    calculatedAt: new Date().toISOString(),
    method:
      "Sugestão por distância rodoviária; sem trânsito ao vivo ou restrições específicas do veículo.",
  };
}
