import { test } from "node:test";
import assert from "node:assert/strict";
import {
  driverMapModel,
  orderedRouteVisits,
} from "../../../src/utils/driverMapModel";

import { markerSvg } from "../../../src/components/maps/mapMarkers";
import type { Collection } from "../../../src/types/collection";
import type { RouteItem } from "../../../src/services/routeService";
const visit = (id: string, status: string, extra: any = {}): Collection =>
  ({
    id,
    routeId: "r1",
    status,
    generator: {
      id: "g",
      name: id,
      address: "Rua Teste",
      latitude: -3.73,
      longitude: -38.52,
    },
    ...extra,
  }) as Collection;
const visits = [
  visit("pending", "PENDING"),
  visit("done", "COMPLETED"),
  visit("pev", "PENDING", {
    bin: { id: "b", name: "PEV", latitude: null, longitude: null },
  }),
  visit("cancelled", "CANCELLED"),
  visit("superseded", "PENDING", {
    cancellationReason: "Substituída por revisão do roteiro fixo",
  }),
];
const route = {
  id: "r1",
  name: "Rota A",
  status: "IN_PROGRESS",
  stops: [],
  collectionOrder: ["done", "pev", "pending", "cancelled", "superseded"],
  collections: visits,
} as RouteItem;
test("Rota selecionada isola visitas, mantém ordem oficial e exclui cancelamentos", () => {
  const snapshot = JSON.stringify(route),
    model = driverMapModel(
      route,
      [
        ...visits,
        visit("foreign", "PENDING", { routeId: "r2" }),
        visit("extra", "PENDING", { routeId: null }),
      ],
      "ROUTE",
    );
  assert.deepEqual(
    model.stops.map((s) => [s.collection.id, s.sequence]),
    [
      ["pev", 2],
      ["pending", 3],
    ],
  );
  assert.equal(model.next?.id, "pev");
  assert.equal(model.missing, 1);
  assert.equal(JSON.stringify(route), snapshot);
});
test("Próxima parada sem coordenadas não é pulada", () => {
  const model = driverMapModel(route, [], "ROUTE");
  assert.equal(model.next?.id, "pev");
  assert.equal(model.stops[0].located, false);
  assert.equal(model.stops[0].kind, "pev");
});
test("Visita em andamento tem prioridade sem alterar a numeração do roteiro", () => {
  const r = {
    ...route,
    collections: [...visits, visit("started", "IN_PROGRESS")],
    collectionOrder: [...route.collectionOrder!, "started"],
  };
  const m = driverMapModel(r, [], "ROUTE");
  assert.equal(m.next?.id, "started");
  assert.equal(m.stops.find((s) => s.collection.id === "started")?.sequence, 5);
  assert.deepEqual(
    orderedRouteVisits(route).map((c) => c.id),
    ["done", "pev", "pending", "cancelled"],
  );
});
test("Exibir atendidas preserva posições e mantém canceladas fora do mapa", () => {
  const m = driverMapModel(route, [], "ROUTE", true);
  assert.deepEqual(
    m.stops.map((s) => [s.collection.id, s.sequence]),
    [
      ["done", 1],
      ["pev", 2],
      ["pending", 3],
    ],
  );
  assert.equal(m.finished, 1);
});
test("Coletas avulsas não recebem sequência de outra rota", () => {
  const m = driverMapModel(
    route,
    [
      ...visits,
      visit("extra", "PENDING", { routeId: null }),
      visit("old-extra", "RECEIVED", { routeId: null }),
    ],
    "UNASSIGNED",
  );
  assert.deepEqual(
    m.stops.map((s) => s.collection.id),
    ["extra"],
  );
  assert.equal(m.stops[0].sequence, null);
  assert.equal(m.next?.id, "extra");
});
test("Visão geral não inventa próxima parada ou ordem entre rotas", () => {
  const m = driverMapModel(
    route,
    [...visits, visit("other", "PENDING", { routeId: "r2" })],
    "ALL",
  );
  assert.equal(m.next, null);
  assert.ok(m.stops.every((s) => s.sequence === null));
  assert.ok(m.stops.some((s) => s.collection.id === "other"));
  assert.ok(!m.stops.some((s) => s.collection.status === "CANCELLED"));
});
test("Snapshot de PEV na rota prevalece sobre cadastro alterado", () => {
  const v = visit("snapshot", "PENDING", {
    routePoint: {
      kind: "PEV",
      key: "pev",
      name: "PEV da rota",
      address: "Rua original",
      latitude: -3.8,
      longitude: -38.6,
    },
  });
  const m = driverMapModel(
    { ...route, collections: [v], collectionOrder: [v.id] },
    [],
    "ROUTE",
  );
  assert.equal(m.stops[0].origin?.name, "PEV da rota");
  assert.equal(m.stops[0].kind, "pev");
  assert.equal(m.stops[0].origin?.latitude, -3.8);
});
test("Indicador de seleção não usa ponto amarelo e sequência de PEV mantém símbolo", () => {
  const svg = markerSvg("pev", "", undefined, true, 2);
  assert.ok(svg.includes(">2</text>"));
  assert.ok(svg.includes("M4 6h16"));
  assert.ok(!svg.includes("#FDE68A"));
  assert.ok(
    !markerSvg("collection", "<script>", "javascript:alert(1)").includes(
      "<script>",
    ),
  );
});

test("Cancelamento de visita mantém o número das paradas restantes", () => {
  const items = [
    visit("one", "PENDING"),
    visit("two", "CANCELLED"),
    visit("three", "PENDING"),
  ];
  const m = driverMapModel(
    { ...route, collections: items, collectionOrder: ["one", "two", "three"] },
    [],
    "ROUTE",
  );
  assert.deepEqual(
    m.stops.map((s) => [s.collection.id, s.sequence]),
    [
      ["one", 1],
      ["three", 3],
    ],
  );
});
