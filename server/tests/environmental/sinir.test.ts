import test from "node:test";
import assert from "node:assert/strict";
import {
  SinirReadClient,
  SinirConfig,
} from "../../src/modules/environmental/sinir.client";
import { prepareSinirPayload } from "../../src/modules/environmental/sinir.payload";
import { validatePayload } from "../../src/modules/environmental/environmental.schemas";
const unit = {
  id: "unit-local",
  taxId: "11222333000181",
  officialUnitCode: "123",
  responsibleName: "Responsável",
};
const config: SinirConfig = {
  enabled: true,
  baseUrl: "https://admin.sinir.gov.br/api",
  environment: "UNCONFIRMED",
  integrationToken: "fake-integration-test-only",
  localUnitId: unit.id,
  taxId: unit.taxId,
  officialUnitCode: "123",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const mock = (
  handler: (url: string, options: RequestInit) => Response | Promise<Response>,
) =>
  (async (url: any, options: any) =>
    handler(String(url), options)) as typeof fetch;
test("Autenticação concorrente é única; Bearer e catálogo não vazam credenciais", async () => {
  const calls: Array<[string, string, string]> = [];
  const client = new SinirReadClient(
    config,
    mock((url, o) => {
      calls.push([url, o.method!, String((o.headers as any).Authorization)]);
      return json(
        url.endsWith("/token")
          ? { erro: false, objetoResposta: "Bearer fake-access-only" }
          : {
              erro: false,
              objetoResposta: [
                {
                  uniCodigo: 1,
                  uniNome: "Quilograma",
                  uniSigla: "kg",
                  token: "DO_NOT_RETURN",
                },
              ],
            },
      );
    }),
  );
  const [a, b] = await Promise.all([
    client.catalog(unit, "units"),
    client.catalog(unit, "units"),
  ]);
  assert.equal(calls.filter((c) => c[0].endsWith("/token")).length, 1);
  assert.ok(
    calls
      .filter((c) => c[1] === "GET")
      .every((c) => c[2] === "Bearer fake-access-only"),
  );
  assert.equal(a.items.length, 1);
  assert.equal(b.items.length, 1);
  assert.equal((await client.catalog(unit, "units")).cached, true);
  assert.ok(!JSON.stringify(client.status()).includes("fake-"));
  assert.ok(!JSON.stringify(a).includes("DO_NOT_RETURN"));
  assert.equal(client.status().canIssueMtr, false);
});
test("401 em leitura renova uma vez, sem repetir operações de escrita", async () => {
  let auth = 0,
    reads = 0;
  const client = new SinirReadClient(
    config,
    mock((url) => {
      if (url.endsWith("/token")) {
        auth++;
        return json({ erro: false, objetoResposta: "Bearer access-" + auth });
      }
      reads++;
      return reads === 1
        ? json({}, 401)
        : json({ erro: false, objeto: [{ uniCodigo: 1, uniSigla: "kg" }] });
    }),
  );
  assert.equal((await client.catalog(unit, "units")).items.length, 1);
  assert.equal(auth, 2);
  assert.equal(reads, 2);
});
test("HTTP 200 com erro, formato inválido e revogação falham sem refletir resposta", async () => {
  for (const body of [
    { erro: true, mensagem: config.integrationToken },
    { erro: false, objetoResposta: {} },
    { erro: false, objetoResposta: "" },
  ]) {
    const c = new SinirReadClient(
      config,
      mock(() => json(body)),
    );
    await assert.rejects(
      c.check(unit),
      (e) => !String(e).includes(config.integrationToken),
    );
    assert.equal(c.status().authenticated, false);
  }
  await assert.rejects(
    new SinirReadClient(
      config,
      mock(() => json({}, 401)),
    ).check(unit),
    { code: "SINIR_UNAUTHORIZED" },
  );
});
test("Unidade, CNPJ, código e host impedem uso de credencial por outra organização", async () => {
  let calls = 0;
  const req = mock(() => {
    calls++;
    return json({});
  });
  for (const u of [
    { ...unit, id: "other" },
    { ...unit, taxId: "00000000000000" },
    { ...unit, officialUnitCode: "999" },
  ])
    await assert.rejects(new SinirReadClient(config, req).check(u), {
      code: "SINIR_UNIT_MISMATCH",
    });
  for (const o of [
    { enabled: false },
    { baseUrl: "https://example.org/api" },
    { baseUrl: "https://admin.sinir.gov.br/api?token=a" },
    { integrationToken: "" },
  ])
    await assert.rejects(
      new SinirReadClient({ ...config, ...o }, req).check(unit),
      { code: "SINIR_NOT_CONFIGURED" },
    );
  assert.equal(calls, 0);
});
test("Falha de rede, JSON inválido e resposta excessiva não confirmam autenticação", async () => {
  await assert.rejects(
    new SinirReadClient(
      config,
      mock(() => {
        throw Error("secret");
      }),
    ).check(unit),
    (e) => !String(e).includes("secret"),
  );
  await assert.rejects(
    new SinirReadClient(
      config,
      mock(() => new Response("not JSON")),
    ).check(unit),
  );
  await assert.rejects(
    new SinirReadClient(
      config,
      mock(
        () => new Response("{}", { headers: { "Content-Length": "9000000" } }),
      ),
    ).check(unit),
  );
});
const party = {
  name: "Participante",
  taxId: unit.taxId,
  officialUnitCode: "123",
  municipalityCode: "2312908",
  address: "Rua A",
};
const material = {
  name: "Papel",
  ibamaCode: "150101",
  quantity: 3,
  unit: "KG",
  officialMeasureCode: "1",
  physicalStateCode: "2",
  classificationCode: "3",
  packagingCode: "4",
  treatmentCode: "5",
  pev: {
    identification: "PEV 1",
    postalCode: "62000000",
    street: "Rua A",
    number: "1",
    complement: "",
    neighborhood: "Centro",
    municipalityCode: "2312908",
    state: "CE",
  },
};
const base = {
  origin: party,
  carrier: party,
  recipient: party,
  vehiclePlate: "ABC1D23",
  driverName: "Motorista",
  departureDate: "2026-10-20",
  materials: [material],
  originManifestNumbers: [],
  invoiceNumber: "",
  invoiceAccessKey: "",
  notes: "Preparação",
};
test("MTR regular usa milissegundos, armazenamento e PEV sem converter quantidades", () => {
  const payload = validatePayload("MTR_REGULAR", {
    ...base,
    hasTemporaryStorage: true,
    temporaryStorage: party,
  });
  const r = prepareSinirPayload({ family: "MTR_REGULAR", payload, unit });
  const o = (r.payload as any)[0];
  assert.equal(r.issues.length, 0);
  assert.equal(r.canTransmit, false);
  assert.equal(o.dataExpedicao, Date.parse("2026-10-20T03:00:00Z"));
  assert.equal(o.armazenadorTemporario.unidade, 123);
  assert.equal(o.listaManifestoResiduos[0].marQuantidade, 3);
  assert.equal(o.listaManifestoResiduos[0].uniCodigo, 1);
  assert.equal(o.listaManifestoResiduos[0].cidCodigoIbge, 2312908);
});
test("LR Processo usa agrupamento, referência e chaveNF com schema próprio", () => {
  const payload = validatePayload("MTR_LR_PROCESS", {
    ...base,
    reverseSystemCode: "7",
    invoiceAccessKey: "1".repeat(44),
    processGroups: [
      {
        originManifestNumber: "ORIGEM-1",
        residueReference: "REF-1",
        materials: [material],
      },
    ],
  });
  const r = prepareSinirPayload({ family: "MTR_LR_PROCESS", payload, unit });
  const o = (r.payload as any)[0];
  assert.equal(r.issues.length, 0);
  assert.equal(o.chaveNF, "1".repeat(44));
  assert.equal(o.simCodigo, 7);
  assert.equal(o.listaManifestoResiduos, undefined);
  assert.equal(
    o.listaManifestoResiduosOrigem[0].listaManifestoResiduosProcesso[0]
      .residuoReferencia,
    "REF-1",
  );
  assert.equal(
    o.listaManifestoResiduosOrigem[0].listaManifestoResiduosProcesso[0]
      .marIdentificacaoOrigemPev,
    undefined,
  );
});
test("CDF segue listaManifesto com objetos e parceiros, sem copiar exemplo divergente", () => {
  const payload = validatePayload("CDF", {
    manifestNumbers: ["001"],
    generators: [party],
    periodStart: "2026-10-01",
    periodEnd: "2026-10-20",
    technicalResponsible: "Técnico",
    technicalRegistration: "REG",
    treatmentDescription: "Reciclagem",
    notes: "",
  });
  const r = prepareSinirPayload({ family: "CDF", payload, unit });
  assert.equal(r.issues.length, 0);
  assert.deepEqual((r.payload as any).listaManifesto, [{ manNumero: "001" }]);
  assert.equal((r.payload as any).listaManifestos, undefined);
  assert.equal((r.payload as any).listaParceiroGerador[0].unidade, 123);
});
test("Legado não recebe código presumido e declaração municipal não tem projeção MTR", () => {
  const p = validatePayload("MTR_REGULAR", {
    ...base,
    materials: [
      { ...material, officialMeasureCode: undefined, pev: undefined },
    ],
  });
  assert.equal(p.materials[0].quantity, 3);
  assert.equal(p.materials[0].officialMeasureCode, "");
  assert.ok(
    prepareSinirPayload({
      family: "MTR_REGULAR",
      payload: p,
      unit,
    }).issues.some((s) => s.includes("unidade de medida")),
  );
  const r = prepareSinirPayload({
    family: "MUNICIPAL_DECLARATION",
    payload: {},
    unit,
  });
  assert.equal(r.payload, null);
  assert.equal(r.canTransmit, false);
});

test("401 persistente encerra a tentativa e limpa estado autenticado", async () => {
  let auth = 0,
    reads = 0;
  const c = new SinirReadClient(
    config,
    mock((url) => {
      if (url.endsWith("/token")) {
        auth++;
        return json({ erro: false, objetoResposta: "Bearer fresh-" + auth });
      }
      reads++;
      return json({}, 401);
    }),
  );
  await assert.rejects(c.check(unit), { code: "SINIR_UNAUTHORIZED" });
  assert.equal(auth, 2);
  assert.equal(reads, 2);
  assert.equal(c.status().authenticated, false);
});

test("Código (*) preservado em rascunho e projeção; sintaxes estranhas são rejeitadas", () => {
  const payload = validatePayload("MTR_REGULAR", {
    ...base,
    materials: [{ ...material, ibamaCode: "150202(*)" }],
  });
  assert.equal(payload.materials[0].ibamaCode, "150202(*)");
  const preview = prepareSinirPayload({ family: "MTR_REGULAR", payload, unit });
  assert.equal(
    (preview.payload as any)[0].listaManifestoResiduos[0].resCodigoIbama,
    "150202(*)",
  );
  assert.ok(preview.issues.some((s) => s.includes("número ONU")));
  for (const code of [
    "150202(**)",
    "150202(*)/outro",
    "150202?token=x",
    "(*)",
    "150202*abc",
  ])
    assert.throws(() =>
      validatePayload("MTR_REGULAR", {
        ...base,
        materials: [{ ...material, ibamaCode: code }],
      }),
    );
});
test("Densidade e dados de perigo são projetados sem conversão em MTR e LR Processo", () => {
  const m = {
    ...material,
    ibamaCode: "150202(*)",
    unit: "LITER",
    officialMeasureCode: "21",
    density: 0.88,
    unNumber: "3082",
    riskClass: "9",
    shippingName: "Resíduo para conferência",
    packingGroup: "III",
  };
  for (const family of ["MTR_REGULAR", "MTR_LR_PROCESS"]) {
    const payload = validatePayload(family, {
      ...base,
      materials: [m],
      reverseSystemCode: "7",
      processGroups: [
        {
          originManifestNumber: "001",
          residueReference: "REF",
          materials: [m],
        },
      ],
    });
    const preview = prepareSinirPayload({ family, payload, unit });
    const out: any = (preview.payload as any)[0];
    const residue =
      family === "MTR_REGULAR"
        ? out.listaManifestoResiduos[0]
        : out.listaManifestoResiduosOrigem[0].listaManifestoResiduosProcesso[0];
    assert.equal(preview.issues.length, 0);
    assert.equal(residue.marDensidade, 0.88);
    assert.equal(residue.marQuantidade, 3);
    assert.equal(residue.uniCodigo, 21);
    assert.equal(residue.marNumeroONU, "3082");
    assert.equal(residue.marClasseRisco, "9");
    assert.equal(residue.marNomeEmbarque, m.shippingName);
    assert.equal(residue.marGrupoEmbalagem, "III");
    assert.equal(preview.canTransmit, false);
  }
});
test("Volume exige conferência de densidade positiva; branco e zero ficam distintos", () => {
  for (const measure of ["LITER", "CUBIC_METER"])
    for (const density of [null, 0]) {
      const payload = validatePayload("MTR_REGULAR", {
        ...base,
        materials: [{ ...material, unit: measure, density }],
      });
      assert.equal(payload.materials[0].density, density);
      const p = prepareSinirPayload({ family: "MTR_REGULAR", payload, unit });
      assert.ok(p.issues.some((s) => s.includes("densidade positiva")));
      const projected = (p.payload as any)[0].listaManifestoResiduos[0];
      assert.equal(projected.marDensidade, density === null ? undefined : 0);
    }
  for (const density of [-1, Infinity, NaN])
    assert.throws(() =>
      validatePayload("MTR_REGULAR", {
        ...base,
        materials: [{ ...material, density }],
      }),
    );
  const old = validatePayload("MTR_REGULAR", base);
  assert.equal(old.materials[0].density, null);
  assert.equal(old.materials[0].unNumber, "");
});
test("Consulta de classe aceita (*) inteiro e bloqueia manipulação do caminho", async () => {
  const calls: string[] = [];
  const c = new SinirReadClient(
    config,
    mock((url) => {
      calls.push(url);
      return json(
        url.endsWith("/token")
          ? { erro: false, objetoResposta: "Bearer fake-access" }
          : {
              erro: false,
              objetoResposta: [{ claCodigo: 1, claDescricao: "Classe I" }],
            },
      );
    }),
  );
  await c.catalog(unit, "classes", "150202(*)");
  assert.ok(
    calls.some((url) =>
      url.endsWith("/retornaListaClassePorResiduo/150202(*)"),
    ),
  );
  const count = calls.length;
  for (const filter of ["150202(*)/outro", "../token", "150202?x=1"])
    await assert.rejects(c.catalog(unit, "classes", filter), {
      code: "INVALID_FILTER",
    });
  await assert.rejects(c.catalog(unit, "packaging", "150202(*)"), {
    code: "INVALID_FILTER",
  });
  assert.equal(calls.length, count);
});
