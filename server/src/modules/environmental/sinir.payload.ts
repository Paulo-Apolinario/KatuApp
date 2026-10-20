/** Projeção local dos schemas do Swagger. Nunca transmite nem confirma validade oficial. */
import { validTaxId } from "./environmental.schemas";
function numberCode(value: unknown, label: string, issues: string[]) {
  const raw = String(value ?? ""),
    n = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(n) ||
    n <= 0 ||
    n > 2147483647
  ) {
    issues.push("Informe código oficial numérico válido: " + label + ".");
    return null;
  }
  return n;
}
function date(value: string, label: string, issues: string[]) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value || "") ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    issues.push("Informe data válida: " + label + ".");
    return null;
  }
  // Data civil de Fortaleza: independente do fuso da máquina que executa a API.
  return Date.parse(value + "T00:00:00-03:00");
}
export function prepareSinirPayload(doc: any) {
  const p = doc.payload,
    unit = doc.unit,
    issues: string[] = [],
    warnings: string[] = [];
  const partner = (v: any, label: string) => {
    if (!validTaxId(v?.taxId || ""))
      issues.push("Informe CPF/CNPJ válido: " + label + ".");
    return {
      cpfCnpj: v?.taxId || "",
      unidade: numberCode(v?.officialUnitCode, label, issues),
    };
  };
  const residue = (m: any, label: string, process = false) => {
    if (!m.ibamaCode?.trim())
      issues.push("Selecione código IBAMA: " + label + ".");
    if (!(m.quantity > 0) || !Number.isFinite(m.quantity))
      issues.push("Informe quantidade positiva: " + label + ".");
    const out: Record<string, unknown> = {
      resCodigoIbama: m.ibamaCode,
      marQuantidade: m.quantity,
      uniCodigo: numberCode(
        m.officialMeasureCode,
        label + " / unidade de medida",
        issues,
      ),
      tieCodigo: numberCode(
        m.physicalStateCode,
        label + " / estado físico",
        issues,
      ),
      claCodigo: numberCode(m.classificationCode, label + " / classe", issues),
      tiaCodigo: numberCode(
        m.packagingCode,
        label + " / acondicionamento",
        issues,
      ),
      traCodigo: numberCode(m.treatmentCode, label + " / tratamento", issues),
      marDescricaoInterna: m.name,
    };
    if (m.pev?.identification) {
      if (process)
        warnings.push(
          "Dados de PEV não são enviados no schema de processo; preserve-os no MTR LR de origem.",
        );
      else {
        Object.assign(out, {
          marIdentificacaoOrigemPev: m.pev.identification,
          marCepNumeroPev: m.pev.postalCode,
          marLogradouroPev: m.pev.street,
          marNumeroPev: m.pev.number,
          marComplementoPev: m.pev.complement,
          marBairroPev: m.pev.neighborhood,
          uf: m.pev.state,
        });
        if (m.pev.municipalityCode)
          out.cidCodigoIbge = numberCode(
            m.pev.municipalityCode,
            label + " / IBGE do PEV",
            issues,
          );
      }
    }
    return out;
  };
  let payload: unknown = null;
  if (doc.family === "MUNICIPAL_DECLARATION")
    return {
      payload: null,
      issues: ["O Swagger MTR não documenta envio da declaração municipal."],
      warnings,
      canTransmit: false,
    };
  if (doc.family === "CDF") {
    if (!p.manifestNumbers?.length)
      issues.push("Relacione os manifestos oficiais recebidos.");
    if (!p.generators?.length)
      issues.push(
        "Identifique os geradores do CDF para conferir o modelo de integração.",
      );
    const start = date(p.periodStart, "início do período", issues),
      end = date(p.periodEnd, "fim do período", issues);
    if (start && end && start > end)
      issues.push("O início do período deve anteceder o fim.");
    payload = {
      cerDataInicial: start,
      cerDataFinal: end,
      cerObservacao: p.notes,
      cnpjDestinador: unit.taxId,
      parceiroDestinador: numberCode(
        unit.officialUnitCode,
        "unidade destinadora",
        issues,
      ),
      nomeResponsavel: p.technicalResponsible,
      listaManifesto: p.manifestNumbers.map((manNumero: string) => ({
        manNumero,
      })),
      listaParceiroGerador: (p.generators || []).map((g: any, i: number) =>
        partner(g, "gerador " + (i + 1)),
      ),
    };
    warnings.push(
      "CDF segue ApiwsCertificadoDestinacaoDTO. Exemplo textual diverge do schema; confirmar comportamento em homologação. Registro profissional e descrição de tratamento permanecem internos.",
    );
  } else {
    const base: Record<string, unknown> = {
      gerador: partner(p.origin, "gerador"),
      transportador: partner(p.carrier, "transportador"),
      destinador: partner(p.recipient, "destinador"),
      nomeMotorista: p.driverName,
      placaVeiculo: p.vehiclePlate.replace(/[-\s]/g, "").toUpperCase(),
      dataExpedicao: date(p.departureDate, "expedição", issues),
      observacoes: p.notes,
    };
    if (p.reverseSystemCode)
      base.simCodigo = numberCode(
        p.reverseSystemCode,
        "sistema de logística reversa",
        issues,
      );
    if (doc.family !== "MTR_REGULAR" && !p.reverseSystemCode)
      issues.push(
        "Selecione o sistema de logística reversa para conferir o modelo.",
      );
    if (doc.family === "MTR_LR_PROCESS") {
      if (!p.processGroups?.length)
        issues.push(
          "Agrupe os resíduos pelos manifestos de origem e referência.",
        );
      if (p.invoiceAccessKey && !/^\d{44}$/.test(p.invoiceAccessKey))
        issues.push("Chave da NF-e deve conter 44 dígitos quando informada.");
      if (p.invoiceAccessKey) base.chaveNF = p.invoiceAccessKey;
      base.listaManifestoResiduosOrigem = (p.processGroups || []).map(
        (g: any, i: number) => {
          if (
            !g.originManifestNumber ||
            !g.residueReference ||
            !g.materials.length
          )
            issues.push(
              "Complete manifesto, referência e resíduos do grupo " +
                (i + 1) +
                ".",
            );
          return {
            numeroManifestoOrigemProcesso: g.originManifestNumber,
            residuoReferencia: g.residueReference,
            listaManifestoResiduosProcesso: g.materials.map(
              (m: any, j: number) => ({
                ...residue(m, `grupo ${i + 1}, resíduo ${j + 1}`, true),
                numeroManifestoOrigemProcesso: g.originManifestNumber,
                residuoReferencia: g.residueReference,
              }),
            ),
          };
        },
      );
      warnings.push(
        "Processo usa schema próprio. Materiais e referências dos rascunhos antigos precisam ser organizados em grupos. Número da nota é interno; informar chave não emite NF-e.",
      );
      if (p.hasTemporaryStorage)
        issues.push(
          "Schema de MTR LR Processo não declara armazenador temporário; revise a operação.",
        );
    } else {
      base.nomeResponsavel = unit.responsibleName;
      base.possuiArmazenamentoTemporario = p.hasTemporaryStorage || false;
      if (p.hasTemporaryStorage)
        base.armazenadorTemporario = partner(
          p.temporaryStorage,
          "armazenador temporário",
        );
      if (!p.materials.length) issues.push("Inclua ao menos um resíduo.");
      base.listaManifestoResiduos = p.materials.map((m: any, i: number) =>
        residue(m, "resíduo " + (i + 1)),
      );
    }
    payload = [base];
  }
  warnings.push(
    "Prévia local, sem transmissão. Códigos, unidades físicas e permissões precisam ser conferidos com os catálogos e o SINIR. Não reenviar emissão automaticamente após timeout.",
  );
  return { payload, issues, warnings, canTransmit: false };
}
