import type { Command } from "./agents.types";
/** Deliberately bounded Portuguese vocabulary. Unsupported filters and mutations never become a broader query. */
export function keywordCandidates(normal: string): Command[] {
  const tokens = normal.split(/\s+/);
  const allowed = new Set(
    (
      "a as o os um uma uns umas de da das do dos em no na nos nas por para pra pro com sem e ou que quais qual quanto quantas quantos " +
      "me mim voce ajuda ajude favor porfavor bom boa dia tarde noite ola oi preciso quero gostaria queria saber ver veja ve verificar verifique mostrar mostre mostra listar liste consultar consulte analisar analise conferir confira tem temos ha existe existem alguma algumas algum alguns todas todos esta estao ta tao sao ser foram foi sendo ainda mais " +
      "coleta coletas solicitacao solicitacoes pedido pedidos atendimento atendimentos pendente pendentes atrasada atrasadas atrasado atrasados atraso atrasos vencida vencidas vencido vencidos prioridade prioridades prioritaria prioritarias urgente urgentes hoje " +
      "rota rotas programada programadas programado programados agendada agendadas agendamento agendamentos atencao problema problemas conflito conflitos motorista motoristas veiculo veiculos faltando falta definido definidos definida definidas " +
      "resumo operacional operacao operacoes indicadores situacao ocorrencia ocorrencias alerta alertas recomendacao recomendacoes proposta propostas revisao aprovacao aguardando " +
      "agente agentes analise analises automacao automacoes processamento fila evento eventos falha falhas falhou erro erros"
    ).split(/\s+/),
  );
  if (tokens.some((t) => !allowed.has(t))) return [];
  const has = (...words: string[]) =>
    words.some((word) => tokens.includes(word));
  const collection = has(
    "coleta",
    "coletas",
    "solicitacao",
    "solicitacoes",
    "pedido",
    "pedidos",
    "atendimento",
    "atendimentos",
  );
  const route = has("rota", "rotas");
  const recommendation = has(
    "recomendacao",
    "recomendacoes",
    "proposta",
    "propostas",
  );
  const automation = has(
    "agente",
    "agentes",
    "automacao",
    "automacoes",
    "processamento",
    "fila",
    "evento",
    "eventos",
    "analise",
    "analises",
  );
  const overdue = has(
    "atrasada",
    "atrasadas",
    "atrasado",
    "atrasados",
    "atraso",
    "atrasos",
    "vencida",
    "vencidas",
    "vencido",
    "vencidos",
  );
  const pending = has("pendente", "pendentes", "aguardando");
  const resource = has("motorista", "motoristas", "veiculo", "veiculos");
  const missing = has("sem", "faltando", "falta");
  const result: Command[] = [];
  if (collection && pending) result.push("PENDING_COLLECTIONS");
  if (collection && overdue) result.push("OVERDUE_REQUESTS");
  if (
    collection &&
    has(
      "prioridade",
      "prioridades",
      "prioritaria",
      "prioritarias",
      "urgente",
      "urgentes",
    )
  )
    result.push("COLLECTION_PRIORITIES");
  if (collection && has("hoje")) result.push("TODAY_COLLECTIONS");
  if (
    route &&
    has(
      "programada",
      "programadas",
      "programado",
      "programados",
      "agendada",
      "agendadas",
      "agendamento",
      "agendamentos",
    )
  )
    result.push("SCHEDULED_ROUTES");
  if (
    route &&
    (overdue ||
      has(
        "atencao",
        "problema",
        "problemas",
        "conflito",
        "conflitos",
        "analisar",
        "analise",
      ))
  )
    result.push("ROUTES_ATTENTION");
  if (route && resource && missing) result.push("ROUTES_WITHOUT_RESOURCES");
  if (has("resumo", "indicadores")) result.push("OPERATIONAL_SUMMARY");
  if (has("ocorrencia", "ocorrencias", "alerta", "alertas"))
    result.push("ATTENTION_OCCURRENCES");
  if (recommendation && (pending || has("revisao", "aprovacao")))
    result.push("PENDING_PROPOSALS");
  if (
    automation &&
    (pending || has("falha", "falhas", "falhou", "erro", "erros", "fila"))
  )
    result.push("AUTOMATION_HEALTH");
  // Do not silently discard a requested intersection/filter that has no implemented tool.
  if (has("hoje") && !result.includes("TODAY_COLLECTIONS")) return [];
  if (resource && !missing) return [];
  if (has("sem") && !result.includes("ROUTES_WITHOUT_RESOURCES")) return [];
  if (
    has(
      "agente",
      "agentes",
      "automacao",
      "automacoes",
      "evento",
      "eventos",
      "fila",
      "processamento",
    ) &&
    !result.includes("AUTOMATION_HEALTH")
  )
    return [];
  if (
    collection &&
    !result.some((c) =>
      [
        "PENDING_COLLECTIONS",
        "OVERDUE_REQUESTS",
        "COLLECTION_PRIORITIES",
        "TODAY_COLLECTIONS",
      ].includes(c),
    )
  )
    result.push("PENDING_COLLECTIONS", "OVERDUE_REQUESTS", "TODAY_COLLECTIONS");
  if (
    route &&
    !result.some((c) =>
      [
        "SCHEDULED_ROUTES",
        "ROUTES_ATTENTION",
        "ROUTES_WITHOUT_RESOURCES",
      ].includes(c),
    )
  )
    result.push(
      "SCHEDULED_ROUTES",
      "ROUTES_ATTENTION",
      "ROUTES_WITHOUT_RESOURCES",
    );
  if (recommendation && !result.includes("PENDING_PROPOSALS")) return [];
  return [...new Set(result)];
}
