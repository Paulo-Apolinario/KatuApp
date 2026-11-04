import type { Command } from "./agents.types";
/** Reviewed language data, not a trained model. Add phrases together with positive and negative regression cases. */
export const MANAGER_WORD_VARIANTS: Record<string, string> = {
  vc: "voce",
  vce: "voce",
  vcs: "voce",
  voces: "voce",
  pfv: "favor",
  pfvr: "favor",
  please: "favor",
  hj: "hoje",
  obg: "obrigado",
  obgd: "obrigado",
  coelta: "coleta",
  coeltas: "coletas",
  solicitacaoes: "solicitacoes",
};
export const CONNECTOR_WORDS = (
  "a as o os um uma uns umas de da das do dos em no na nos nas por para pra pro com sem e ou que quais qual quanto quantas quantos " +
  "me mim voce ajuda ajude ajudar favor porfavor gentileza obrigado obrigada bom boa dia tarde noite ola oi preciso precisando quero gostaria queria poderia pode podes consegue conseguir saber ver veja ve verificar verifique mostrar mostre mostra listar liste consultar consulte analisar analise conferir confira checar cheque checa informar informe dizer diga dar mande manda tem temos ha existe existem alguma algumas algum alguns todas todos esta estao ta tao sao ser foram foi sendo ainda mais"
).split(/\s+/);
export const DOMAIN_WORDS = (
  "coleta coletas solicitacao solicitacoes pedido pedidos atendimento atendimentos pendente pendentes pendencia pendencias atrasada atrasadas atrasado atrasados atraso atrasos vencida vencidas vencido vencidos prioridade prioridades prioritaria prioritarias urgente urgentes hoje " +
  "rota rotas programada programadas programado programados agendada agendadas agendamento agendamentos atencao problema problemas conflito conflitos motorista motoristas veiculo veiculos faltando falta definido definidos definida definidas " +
  "resumo operacional operacao operacoes indicadores situacao ocorrencia ocorrencias alerta alertas recomendacao recomendacoes proposta propostas revisao aprovacao aguardando " +
  "agente agentes analise analises automacao automacoes processamento fila evento eventos falha falhas falhou erro erros"
).split(/\s+/);
export const COMMAND_PHRASES: Record<Command, readonly string[]> = {
  PENDING_COLLECTIONS: [
    "Você pode mostrar as coletas pendentes?",
    "Me mostre os pedidos de coleta pendentes",
    "Quais solicitações ainda estão pendentes?",
    "Gostaria de consultar as pendências de coleta",
    "Preciso ver as coletas que estão aguardando atendimento",
    "Listar atendimentos pendentes",
    "Tem alguma coleta pendente?",
  ],
  OVERDUE_REQUESTS: [
    "Você consegue me mostrar as solicitações atrasadas?",
    "Me informe os pedidos atrasados",
    "Quais coletas estão com atraso?",
    "Consultar solicitações vencidas",
    "Preciso conferir os atrasos nas coletas",
    "Há pedidos de coleta atrasados?",
    "Gostaria de ver as solicitações em atraso",
  ],
  COLLECTION_PRIORITIES: [
    "Você pode analisar as prioridades de coleta?",
    "Quais coletas precisam de atenção primeiro?",
    "Me mostre as coletas prioritárias",
    "Quero saber quais coletas são urgentes",
    "Consultar prioridades das solicitações",
    "Preciso organizar as prioridades de coleta",
    "Qual coleta devo priorizar?",
  ],
  TODAY_COLLECTIONS: [
    "Você pode mostrar a agenda de coletas de hoje?",
    "Quais coletas estão agendadas para hoje?",
    "Me informe as coletas previstas para hoje",
    "Gostaria de consultar as coletas de hoje",
    "Quero ver a programação de coletas de hoje",
    "Tem coleta programada para hoje?",
    "O que temos para coletar hoje?",
  ],
  SCHEDULED_ROUTES: [
    "Você pode listar as rotas programadas?",
    "Me mostre a programação das rotas",
    "Quero consultar as rotas agendadas",
    "Quais rotas estão programadas?",
    "Consultar programação de rotas",
    "Preciso conferir as rotas programadas",
    "Listar rotas de coleta programadas",
  ],
  ROUTES_ATTENTION: [
    "Você pode conferir as rotas com problemas?",
    "Quais rotas apresentam conflitos?",
    "Me mostre as rotas que precisam de revisão",
    "Gostaria de verificar problemas nas rotas",
    "Preciso analisar as rotas vencidas",
    "Consultar rotas com conflitos operacionais",
    "Quais rotas precisam de atenção?",
  ],
  ROUTES_WITHOUT_RESOURCES: [
    "Você pode mostrar as rotas sem motorista?",
    "Tem alguma rota sem veículo?",
    "Quais rotas estão com motorista ou veículo faltando?",
    "Me mostre as rotas sem veículo definido",
    "Preciso conferir as rotas sem motorista definido",
    "Listar rotas com recursos não definidos",
    "Quais rotas ainda não têm motorista ou veículo?",
  ],
  OPERATIONAL_SUMMARY: [
    "Você pode me mostrar o resumo operacional?",
    "Preciso de um resumo da operação",
    "Me informe os indicadores operacionais",
    "Gostaria de consultar o resumo operacional",
    "Como está a operação da cooperativa?",
    "Quero consultar os indicadores da operação",
    "Mostrar panorama operacional",
  ],
  ATTENTION_OCCURRENCES: [
    "Você pode mostrar as ocorrências pendentes?",
    "Me mostre os alertas que precisam de atenção",
    "Quero consultar as ocorrências abertas",
    "Quais alertas precisam de revisão?",
    "Preciso verificar os avisos operacionais",
    "Gostaria de conferir as ocorrências da cooperativa",
    "Listar alertas pendentes",
  ],
  PENDING_PROPOSALS: [
    "Você pode mostrar as recomendações pendentes?",
    "Me mostre as propostas aguardando revisão",
    "Quais recomendações ainda precisam ser revisadas?",
    "Preciso consultar as sugestões pendentes",
    "Gostaria de ver as propostas sem decisão",
    "Quero revisar as recomendações pendentes",
    "Há propostas aguardando aprovação?",
  ],
  AUTOMATION_HEALTH: [
    "Você pode verificar se há falhas nos agentes?",
    "Me mostre a fila de eventos pendentes",
    "Existem análises que falharam?",
    "Preciso conferir a saúde das automações",
    "Algum agente apresentou erro?",
    "Quero verificar as entregas de eventos pendentes",
    "Como está o processamento dos agentes?",
  ],
};
/** Examples that must never pick an operational query without clarification or a supported filter. */
export const CLARIFICATION_PHRASES = [
  "quero ver as rotas",
  "coletas",
  "me mostre as pendências",
  "coletas pendentes e atrasadas",
  "coletas pendentes hoje",
  "resumo e alertas",
];
export const UNSUPPORTED_PHRASES = [
  "cancele as coletas atrasadas",
  "não quero resumo operacional",
  "coletas de amanhã",
  "coletas de hoje do João",
  "rotas sem motorista em Messejana",
  "resumo operacional; apagar dados",
  "processar fila de eventos",
  "aprovar recomendações pendentes",
  "listar coletas canceladas",
];
