/** Cliente estritamente de autenticação e leitura. Nenhuma rota de emissão é executável. */
export type SinirConfig = {
  enabled: boolean;
  baseUrl: string;
  environment: "UNCONFIRMED" | "HOMOLOGATION" | "PRODUCTION";
  integrationToken: string;
  localUnitId: string;
  taxId: string;
  officialUnitCode: string;
};
export class SinirError extends Error {
  constructor(
    message: string,
    public code = "SINIR_UNAVAILABLE",
    public statusCode = 502,
  ) {
    super(message);
  }
}
const catalogPaths = {
  residues: "/retornaListaResiduo",
  units: "/retornaListaUnidade",
  classes: "/retornaListaClasse",
  physicalStates: "/retornaListaEstadoFisico",
  packaging: "/retornaListaAcondicionamento",
  treatments: "/retornaListaTratamento",
  reverseSystems: "/retornaListaSistemaLogisticaReversa",
} as const;
export type Catalog = keyof typeof catalogPaths;
export const catalogNames = Object.keys(catalogPaths) as Catalog[];
export function readSinirConfig(
  source: NodeJS.ProcessEnv = process.env,
): SinirConfig {
  return {
    enabled: source.SINIR_ENABLED === "true",
    baseUrl: (
      source.SINIR_BASE_URL || "https://admin.sinir.gov.br/api"
    ).replace(/\/$/, ""),
    environment:
      source.SINIR_ENVIRONMENT === "HOMOLOGATION"
        ? "HOMOLOGATION"
        : source.SINIR_ENVIRONMENT === "PRODUCTION"
          ? "PRODUCTION"
          : "UNCONFIRMED",
    integrationToken: source.SINIR_INTEGRATION_TOKEN?.trim() || "",
    localUnitId: source.SINIR_LOCAL_UNIT_ID?.trim() || "",
    taxId: source.SINIR_UNIT_TAX_ID?.trim() || "",
    officialUnitCode: source.SINIR_OFFICIAL_UNIT_CODE?.trim() || "",
  };
}
function configured(c: SinirConfig) {
  try {
    const url = new URL(c.baseUrl);
    return (
      c.enabled &&
      !!c.integrationToken &&
      !!c.localUnitId &&
      /^\d{14}$/.test(c.taxId) &&
      /^\d+$/.test(c.officialUnitCode) &&
      url.protocol === "https:" &&
      (url.hostname === "sinir.gov.br" ||
        url.hostname.endsWith(".sinir.gov.br")) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !url.port &&
      url.pathname === "/api"
    );
  } catch {
    return false;
  }
}
export class SinirReadClient {
  private token = "";
  private expiresAt = 0;
  private pending?: Promise<void>;
  private checkedAt: string | null = null;
  private cache = new Map<string, { expires: number; data: unknown[] }>();
  constructor(
    private config: SinirConfig,
    private request: typeof fetch = fetch,
  ) {}
  status() {
    return {
      configured: configured(this.config),
      environment: this.config.environment,
      mode: "READ_ONLY",
      authenticated: !!this.token && Date.now() < this.expiresAt,
      checkedAt: this.checkedAt,
      canIssueMtr: false,
      canIssueCdf: false,
      canSubmitMunicipalDeclaration: false,
    };
  }
  assertBinding(unit: {
    id: string;
    taxId: string;
    officialUnitCode: string | null;
  }) {
    if (!configured(this.config))
      throw new SinirError(
        "Integração de leitura não configurada no servidor para esta instalação.",
        "SINIR_NOT_CONFIGURED",
        503,
      );
    if (
      unit.id !== this.config.localUnitId ||
      unit.taxId !== this.config.taxId ||
      unit.officialUnitCode !== this.config.officialUnitCode
    )
      throw new SinirError(
        "A credencial do servidor não está vinculada a esta unidade e CNPJ. Confira a configuração com o responsável pela instalação.",
        "SINIR_UNIT_MISMATCH",
        403,
      );
  }
  private async json(path: string, bearer: string, method: "GET" | "POST") {
    let response: Response;
    try {
      response = await this.request(this.config.baseUrl + path, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + bearer,
        },
      });
    } catch {
      throw new SinirError(
        "O SINIR não respondeu. Nenhuma emissão foi tentada.",
      );
    }
    if (response.status === 401)
      throw new SinirError(
        "Credencial recusada ou expirada no SINIR.",
        "SINIR_UNAUTHORIZED",
        502,
      );
    if (response.status === 403)
      throw new SinirError(
        "O SINIR recusou a permissão desta unidade.",
        "SINIR_FORBIDDEN",
        502,
      );
    if (!response.ok)
      throw new SinirError(
        "O SINIR retornou uma falha. Tente novamente mais tarde.",
      );
    const length = Number(response.headers.get("content-length"));
    if (length > 8 * 1024 * 1024)
      throw new SinirError("Resposta do SINIR acima do limite permitido.");
    const reader = response.body?.getReader();
    if (!reader) throw new SinirError("Resposta vazia do SINIR.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      let part;
      try {
        part = await reader.read();
      } catch {
        throw new SinirError("Falha ao ler a resposta do SINIR.");
      }
      if (part.done) break;
      size += part.value.length;
      if (size > 8 * 1024 * 1024) {
        await reader.cancel();
        throw new SinirError("Resposta do SINIR acima do limite permitido.");
      }
      chunks.push(part.value);
    }
    let data: any;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new SinirError("Resposta do SINIR fora do formato JSON esperado.");
    }
    if (
      !data ||
      typeof data !== "object" ||
      data.erro === true ||
      data.erroNacional === true ||
      data.restResponseValido === false
    )
      throw new SinirError(
        "O SINIR não confirmou o sucesso da consulta. Confira a habilitação da unidade.",
        "SINIR_BUSINESS_ERROR",
      );
    return data;
  }
  private async authenticate() {
    if (this.token && Date.now() < this.expiresAt) return;
    if (!this.pending) {
      this.pending = (async () => {
        this.token = "";
        this.expiresAt = 0;
        const data = await this.json(
          "/token",
          this.config.integrationToken,
          "POST",
        );
        const bearer =
          typeof data.objetoResposta === "string"
            ? data.objetoResposta.replace(/^Bearer\s+/i, "").trim()
            : "";
        if (data.erro !== false || !bearer || /\s/.test(bearer))
          throw new SinirError(
            "Formato do token de acesso do SINIR não confirmado.",
            "SINIR_RESPONSE_INVALID",
          );
        let ttl = 8 * 60 * 60 * 1000;
        // exp só reduz o tempo em cache; a confirmação da credencial vem da API oficial.
        try {
          const exp = JSON.parse(
            Buffer.from(bearer.split(".")[1], "base64url").toString(),
          ).exp;
          if (typeof exp === "number")
            ttl = Math.min(ttl, exp * 1000 - Date.now());
        } catch {
          /* O contrato também permite tratar o token como opaco. */
        }
        if (ttl <= 60000)
          throw new SinirError(
            "SINIR retornou token de acesso já expirado ou prestes a expirar.",
          );
        this.token = bearer;
        this.expiresAt = Date.now() + ttl - 60000;
        this.checkedAt = new Date().toISOString();
      })().finally(() => {
        this.pending = undefined;
      });
    }
    await this.pending;
  }
  async check(unit: Parameters<SinirReadClient["assertBinding"]>[0]) {
    this.assertBinding(unit);
    // Verificação explícita consulta a API, mesmo quando há token ainda válido.
    this.cache.delete(catalogPaths.units);
    await this.catalog(unit, "units");
    this.checkedAt = new Date().toISOString();
    return this.status();
  }
  async catalog(
    unit: Parameters<SinirReadClient["assertBinding"]>[0],
    name: Catalog,
    filter?: string,
  ) {
    this.assertBinding(unit);
    if (!catalogNames.includes(name))
      throw new SinirError("Catálogo não permitido.", "INVALID_CATALOG", 400);
    if (filter && !/^[A-Za-z0-9 .-]{1,40}$/.test(filter))
      throw new SinirError(
        "Filtro de catálogo inválido.",
        "INVALID_FILTER",
        400,
      );
    const path =
      filter && name === "classes"
        ? "/retornaListaClassePorResiduo/" + encodeURIComponent(filter)
        : filter && name === "packaging"
          ? "/retornaListaAcondicionamentoPorEstadoFisico/" +
            encodeURIComponent(filter)
          : catalogPaths[name];
    const cached = this.cache.get(path);
    if (
      cached &&
      Date.now() < cached.expires &&
      this.token &&
      Date.now() < this.expiresAt
    )
      return { items: cached.data, cached: true };
    await this.authenticate();
    let data;
    const originalToken = this.token;
    try {
      data = await this.json(path, originalToken, "GET");
    } catch (error) {
      if (!(error instanceof SinirError) || error.code !== "SINIR_UNAUTHORIZED")
        throw error;
      if (this.token === originalToken) {
        this.token = "";
        this.expiresAt = 0;
        this.cache.clear();
      }
      await this.authenticate();
      // Somente leitura pode repetir automaticamente, uma única vez.
      try {
        data = await this.json(path, this.token, "GET");
      } catch (retryError) {
        if (
          retryError instanceof SinirError &&
          retryError.code === "SINIR_UNAUTHORIZED"
        ) {
          this.token = "";
          this.expiresAt = 0;
          this.cache.clear();
        }
        throw retryError;
      }
    }
    const list = data.objetoResposta ?? data.objeto;
    if (!Array.isArray(list) || list.length > 50000)
      throw new SinirError(
        "Estrutura do catálogo oficial não reconhecida.",
        "SINIR_RESPONSE_INVALID",
      );
    // Somente campos de catálogo conhecidos são repassados; nunca refletir o retorno bruto.
    const fields = [
      "resCodigo",
      "resCodigoIbama",
      "resNome",
      "resDescricao",
      "uniCodigo",
      "uniNome",
      "uniDescricao",
      "uniSigla",
      "claCodigo",
      "claNome",
      "claDescricao",
      "tieCodigo",
      "tieNome",
      "tieDescricao",
      "tiaCodigo",
      "tiaNome",
      "tiaDescricao",
      "traCodigo",
      "traNome",
      "traDescricao",
      "simCodigo",
      "simNome",
      "simDescricao",
    ];
    const codeField = {
      residues: "resCodigoIbama",
      units: "uniCodigo",
      classes: "claCodigo",
      physicalStates: "tieCodigo",
      packaging: "tiaCodigo",
      treatments: "traCodigo",
      reverseSystems: "simCodigo",
    }[name];
    const items = list.map((row: any) => {
      if (
        !row ||
        typeof row !== "object" ||
        !["string", "number"].includes(typeof row[codeField]) ||
        String(row[codeField]).trim() === ""
      )
        throw new SinirError("Item de catálogo oficial inválido.");
      return Object.fromEntries(
        fields
          .filter(
            (k) => typeof row[k] === "string" || typeof row[k] === "number",
          )
          .map((k) => [
            k,
            typeof row[k] === "string" ? row[k].slice(0, 1000) : row[k],
          ]),
      );
    });
    if (this.cache.size >= 100) this.cache.clear();
    this.cache.set(path, { expires: Date.now() + 10 * 60000, data: items });
    return { items, cached: false };
  }
}
export const sinirClient = new SinirReadClient(readSinirConfig());
