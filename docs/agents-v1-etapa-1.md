# KATUÁ Agents v1 — entrega técnica da etapa 1

Data: 04/11/2026. Desenvolvedores e criadores da plataforma: **Paulo Roberto Apolinario da Silva** e **Nilton Felipe de Oliveira Braz**.

## Escopo e estado

Backend consultivo implementado a partir da `main` atualizada, base `d06cfa6b511b2edd1d36b6a3c153ae4858238fa1`, na branch local `work/agents-v1-backend-20261104`. A referência `main` não foi alterada. Sem push, merge, execução de migração em produção ou deploy. O frontend foi consultado na `main` atualizada e permanece sem alterações.

A conversa indicada por link não pôde ser recuperada. Esta implementação segue o escopo detalhado fornecido diretamente na solicitação desta etapa.

Não há API paga, modelo de linguagem local, Ollama, Redis ou nova dependência de execução. O interpretador usa um catálogo fechado de comandos. Não há executor de operações: nenhuma análise ou aprovação modifica, cancela ou conclui coleta, rota, peso ou estoque.

## Agentes implementados

| Agente | Fontes e comportamento | Saídas |
|---|---|---|
| AgentCollections | Solicitações/agendamentos ativos, coletas em campo, ordens extras aguardando análise/complemento e relatos de PEV sem coleta vinculada. Usa o limiar de atraso das preferências existentes. | Pendências, sinais explícitos de inconsistência e antiguidade, IDs/links e propostas de agrupamento de solicitações ainda não delegadas no mesmo município, bairro e dia. |
| AgentRoutes | Rotas programadas/em campo. Reutiliza `validateTeam`, `checkConflict`, `validatePoints`, `optimizeSchema` e `suggestSequence` do planejamento existente. | Falta de programação/equipe/veículo/pontos, conflito de horário e propostas de revisão. A sugestão de sequência usa distância geométrica local, sem aplicar a ordem. |
| AgentManager | Reutiliza `operationalOverview` e `refreshAlerts`, sem executar `dispatchNotifications` nem envio SMTP. | Resumo operacional, indicadores por unidade, ocorrências abertas não adiadas e recomendações sobre alertas críticos. |

O Gestor atualiza **metadados de SystemAlert pelo motor existente** antes de consultar o resumo. Isso pode abrir, resolver ou reabrir alertas conforme as regras já existentes da central. Não altera os registros operacionais e não cria um segundo cadastro de ocorrências. O novo histórico de propostas é separado dos alertas.

A priorização é determinística, com motivos visíveis e antiguidade; não representa inferência de IA ou prazo contratual. Data programada, desejada e criação são referências distintas. As contagens de solicitações, coletas, ordens extras e relatos de PEV não representam uma soma de atendimentos únicos. Kg e litros permanecem separados.

A proposta de agrupamento exige data programada/desejada e bairro/município conhecidos; não presume uma data para pedidos sem previsão. Endereço, capacidade, janelas e disponibilidade precisam ser conferidos pelo gestor. A sugestão geométrica não representa percurso rodoviário, trânsito ou economia garantida.

## Persistência e migração

Migração: `server/prisma/migrations/20261104020000_agents_v1/migration.sql`.

Ela cria somente tabelas, enums, índices e vínculos novos; não redefine tabelas anteriores nem apaga dados. Preserva `SystemAlert`, `InboxNotification`, `CooperativeSettings` e os demais modelos. Aplicação validada somente em banco local descartável, sobre schema anterior com dados já existentes.

| Modelo | Finalidade e garantias principais |
|---|---|
| AgentConfig | Configuração por cooperativa/agente, habilitação, intervalo, próxima execução e versão. Único por cooperativa/agente. |
| AgentRun | Agente, comando, origem, usuário opcional, conversa opcional, status, prazo, resultado e erro resumido. Evento único por cooperativa com hash do conteúdo. |
| AgentConversation | Histórico da cooperativa e usuário proprietário, título e timestamps. |
| AgentMessage | Mensagens USER/ASSISTANT, texto e resposta estruturada. Uma mensagem por papel/execução. Vínculos compostos com cooperativa impedem cruzamento de conversa/execução entre cooperativas. |
| AgentProposal | Evidência, impressão digital, execução de origem, tipo, versão e estado. Evidência igual não gera proposta ou aviso repetido. |
| AgentAuditEvent | Eventos de configuração, início/fim/falha, proposta e decisão, com ator, alvo, dados e chave única de evento. Sem APIs de edição/exclusão. |

Enums: `AgentKey`, `AgentRunStatus`, `AgentOrigin`, `AgentProposalStatus`, `AgentMessageRole`.

- Execução: `RUNNING → SUCCEEDED` ou `RUNNING → FAILED`.
- Origem: `MANUAL`, `COMMAND` ou `SCHEDULED`.
- Proposta: `PENDING → APPROVED` ou `PENDING → REJECTED` nesta etapa.
- `EXECUTED` e `FAILED` constam no enum de proposta para evolução. Não há transição pública para esses estados nem endpoint de execução nesta versão.
- Aprovar registra a decisão humana e a auditoria; **não executa a recomendação**. Uma futura execução terá que conferir novamente permissões, estado dos registros e evidências atuais.

## APIs autenticadas

Todas exigem JWT válido, usuário ativo do perfil **COOPERATIVE**, vínculo com a cooperativa e `AGENTS_ENABLED=true`. A cooperativa é obtida no servidor a partir do usuário, nunca de um parâmetro enviado pelo cliente. `MUNICIPAL_MANAGER` e os demais perfis são bloqueados.

Não há prefixo `/api` adicional nesses caminhos. Respostas usam `Cache-Control: private, no-store`.

| Método | Caminho | Uso |
|---|---|---|
| GET | `/agents` | Catálogo, comandos e configuração atual/default. |
| PATCH | `/agents/:agent/config` | Habilitar/desabilitar e configurar intervalo com versão e evento. |
| POST | `/agents/:agent/run` | Executar análise padrão do agente sob demanda. |
| POST | `/agents/commands` | Interpretar comando textual ou estruturado, executar e registrar conversa. |
| GET | `/agents/runs` | Histórico, filtros `agent`/`status`, cursor e limite. |
| GET | `/agents/runs/:id` | Resultado e detalhes de uma execução. |
| GET | `/agents/conversations` | Conversas do usuário/cooperativa. |
| GET | `/agents/conversations/:id/messages` | Mensagens paginadas, mais recentes primeiro. |
| GET | `/agents/proposals` | Propostas, filtro `status`, cursor e limite. |
| GET | `/agents/proposals/:id` | Evidência e estado da proposta. |
| POST | `/agents/proposals/:id/decision` | Aprovação/rejeição humana com motivo, versão e evento. |
| GET | `/agents/occurrences` | Leitura das ocorrências abertas/não adiadas de `SystemAlert`. Não recalcula alertas por si só. |
| GET | `/agents/audit` | Trilha paginada de auditoria da cooperativa. |

Valores de `:agent`: `COLLECTIONS`, `ROUTES`, `MANAGER`. Listagens: `limit` de 1 a 50, padrão 20, com `nextCursor`. Cursor inexistente/alheio não é aceito. APIs de lista retornam `{ data, nextCursor }`.

### Exemplos de corpos de requisição em homologação

Habilitação inicial; `expectedVersion: 0` indica configuração ainda não criada:

```json
{
  "enabled": true,
  "intervalMinutes": 60,
  "expectedVersion": 0,
  "eventId": "config_coletas_001"
}
```

Análise padrão em `POST /agents/COLLECTIONS/run`:

```json
{"eventId":"analise_coletas_001"}
```

Comando em `POST /agents/commands`:

```json
{"text":"Quais coletas estão pendentes?","eventId":"chat_coletas_001"}
```

Para continuar uma conversa, acrescente `conversationId` retornado na execução. Alternativamente use `command`, **sem `text`**:

```json
{"command":"OPERATIONAL_SUMMARY","eventId":"resumo_gestor_001"}
```

Decisão em `POST /agents/proposals/:id/decision`:

```json
{
  "status":"APPROVED",
  "expectedVersion":1,
  "reason":"Conferido pela gestão para planejamento posterior.",
  "eventId":"decisao_proposta_001"
}
```

Eventos precisam ter 8 a 100 letras, números, traços ou sublinhados. Repita o mesmo evento e corpo quando a resposta se perder. Outro conteúdo com o mesmo identificador retorna conflito. Uma execução concluída com falha é terminal; confira o histórico antes de solicitar nova análise com outro evento.

Execuções retornam `{ run, replayed }`; comandos reconhecidos incluem `recognized: true`. `run.result` possui `agent`, `command`, `generatedAt`, `summary`, `counts`, `items`, `warnings`, `truncated`, `method`, `proposalIds`, `advisoryOnly` e indicadores quando aplicáveis. Cada item traz tipo, ID, título, link e motivos. Durante uma repetição concorrente o estado pode continuar `RUNNING`: consulte `/agents/runs/:id`.

Estados HTTP: 200 concluído/repetido; 202 execução ainda em andamento; 400 entrada inválida; 401 sessão inválida/inativa; 403 perfil/vínculo bloqueado; 404 registro/cursor inexistente ou alheio; 409 evento, versão, configuração ou concorrência conflitante; 429 limite; 503 módulo desativado, análise falhou ou serviço indisponível. Falhas persistidas incluem `errorCode`, sem detalhe bruto de banco na resposta.

### Comandos iniciais

| Chave | Exemplo textual |
|---|---|
| PENDING_COLLECTIONS | Quais coletas estão pendentes? |
| OVERDUE_REQUESTS | Mostrar solicitações atrasadas. |
| COLLECTION_PRIORITIES | Analisar prioridades de coleta. |
| SCHEDULED_ROUTES | Verificar rotas programadas. |
| ROUTES_ATTENTION | Quais rotas precisam de atenção? |
| OPERATIONAL_SUMMARY | Mostrar resumo operacional. |
| ATTENTION_OCCURRENCES | Quais ocorrências precisam de atenção? |

Acentos, capitalização, espaços e pontuação simples são normalizados; há aliases explícitos. Texto fora do catálogo retorna `recognized: false`, orientação e opções, sem executar ferramentas ou criar conversa. Não há compreensão livre, geração de SQL ou execução de instruções contidas no texto.

## Execução automática e proteção da VPS

- Opt-in global: `AGENTS_ENABLED=false` por padrão, documentado em `server/.env.example`. Sem ativação, APIs retornam indisponibilidade e o worker não consulta as novas tabelas.
- Opt-in por cooperativa/agente: configurações inexistentes são exibidas desativadas. Habilitar exige ação autenticada e auditada.
- Worker no processo Node existente, iniciado após `listen`, verificação a cada minuto, sem painel conectado. Fecha timer e aguarda tarefa em andamento no encerramento.
- Intervalo por agente entre 15 e 1440 minutos; padrão 60. Primeira análise fica elegível após cerca de um minuto. Não há promessa de execução no segundo exato.
- Até três configurações vencidas por ciclo, em sequência; uma análise global simultânea e uma por cooperativa. Bloqueio transacional PostgreSQL e estado persistido protegem também múltiplos processos.
- Até dez análises/minuto e cem em uma janela de 24 horas por cooperativa, somando os três agentes e todas as origens. Três agentes por hora consomem até 72 análises em 24 horas; intervalos menores podem atingir o limite diário.
- Não há fila de operações. Demanda concorrente retorna conflito; o agendamento adia tentativas bloqueadas em 1 minuto e por limite em 15 minutos, evitando que uma cooperativa monopolize as primeiras posições do ciclo.
- Chave de evento de agendamento deriva da configuração e da data de vencimento. A próxima data avança ao reservar a execução; não há repetição automática de execução com resultado incerto nem recuperação em massa de todos os horários perdidos.
- Prazo de 15 minutos por execução. Rotina independente encerra metadados de análises interrompidas como `FAILED/LEASE_EXPIRED`, sem repetir a operação. Resultado tardio não pode concluir a execução expirada. Isso não equivale a cancelar imediatamente uma consulta de banco em andamento.
- Até cem itens por fonte de consulta, cem itens finais, dez propostas e vinte validações detalhadas de rota por análise. Otimização limitada a sessenta pontos. Respostas indicam corte/limitações.
- Sem geocoding, OSRM, e-mail ou requisição externa obrigatória no motor de agentes. O cálculo geométrico reutiliza o algoritmo existente localmente.

## Sino e integração futura

Propostas novas gravam um único aviso por destinatário/evento usando `notifyCooperative` e `InboxNotification`, na mesma transação da conclusão. O sino e a central existentes conseguem contar e exibir esses avisos. Propostas ligadas a rota/solicitação incluem os IDs já aceitos pelos links atuais. As demais permanecem como avisos informativos, disponíveis também pela API de propostas.

`proposalId` e `agentRunId` ficam preparados no payload. Não foi criada tela nova, alterado sino, Central de Agentes ou ChatBox. Essas interfaces pertencem a outra etapa.

`CommandInterpreter` separa interpretação de `AgentTools` e da execução. Uma futura integração deve produzir apenas chaves do catálogo; permissões, consultas, limites e decisões continuam no backend. Nenhum provedor de IA foi instalado ou conectado.

## Arquivos

Modificados:

- `server/prisma/schema.prisma`: seis modelos e cinco enums novos e relações inversas.
- `server/src/app.ts`: registro do módulo de APIs, sem substituir rotas existentes.
- `server/src/server.ts`: registro do worker no ciclo de vida existente.
- `server/.env.example`: chave global desativada por padrão.

Criados em `server/src/modules/agents/`:

| Arquivo | Responsabilidade |
|---|---|
| agents.types.ts | Tipos de resposta, catálogo de agentes, limites e erro controlado. |
| agents.schemas.ts | Validações Zod das entradas. |
| agents.permissions.ts | Perfil, vínculo e habilitação global. |
| agents.commands.ts | Catálogo, normalização, aliases e interface de interpretação. |
| agents.tools.ts | Registro fechado das ferramentas consultivas. |
| agents.collections.ts | Análise de solicitações/coletas e agrupamento. |
| agents.request-sources.ts | Consulta das ordens extras e relatos de PEV. |
| agents.routes-analysis.ts | Análise e sugestões de rotas usando planejamento existente. |
| agents.manager.ts | Resumo do dashboard e leitura/atualização da central de alertas existente. |
| agents.config.ts | Configuração versionada, idempotente e auditada. |
| agents.execution.ts | Reserva, limites, execução, conclusão e falhas persistidas. |
| agents.recovery.ts | Recuperação de histórico interrompido sem reexecutar operações. |
| agents.triggers.ts | Agendamento leve e ciclo de vida do worker. |
| agents.proposals.ts | Evidência, duplicidade, aviso e decisão humana. |
| agents.audit.ts | Hash, eventos de auditoria e bloqueio transacional. |
| agents.routes.ts | Endpoints e paginação com isolamento por cooperativa. |

Outros novos:

- `server/prisma/migrations/20261104020000_agents_v1/migration.sql`.
- `server/tests/agents/run.mjs` e `integration.ts`.
- `docs/agents-v1-etapa-1.md` e `docs/agents-v1-validacao-2026-11-04.json`.

## Validação executada

- Prisma `validate` e geração do cliente: aprovados.
- Migração incremental aplicada sobre schema anterior no banco descartável: cooperativa e alerta anteriores preservados.
- **62 cenários dos agentes aprovados**, com Fastify/JWT/Prisma reais e PGlite descartável via socket local.
- **35 verificações adicionais aprovadas** na regressão existente de operações em campo, rotas e encerramento parcial.
- `npm --prefix server run check`: aprovado.
- `npm --prefix server run build`: aprovado; bundle do servidor aproximadamente 987 KB.
- `git diff --check`: aprovado.

Casos incluem os sete comandos e variações, orientação para texto desconhecido/malicioso, perfis bloqueados, duas cooperativas, registros inexistentes, idempotência e conflitos, versão, conversas/mensagens, FK composta, prioridade/agrupamento, PEV/ordens extras, conflitos de motorista/veículo, sugestão geométrica, decisões sem execução, avisos, falha e recuperação, limites persistidos, concorrência por cooperativa/global e gatilho sem painel. O snapshot de coletas, solicitações, rotas e estoque foi conferido antes/depois das análises e decisões.

Para reproduzir em ambiente local descartável, instale as dependências já existentes do servidor e use um diretório externo com `@electric-sql/pglite` e `@electric-sql/pglite-socket`. Depois:

```bash
KATUA_VALIDATION_TOOLS=/caminho/absoluto/ferramentas node server/tests/agents/run.mjs
npm --prefix server run check
npm --prefix server run build
```

O executor cria o banco em memória, usa exclusivamente `127.0.0.1:54329` e encerra os recursos ao final. Não utiliza a conexão da VPS. O teste verifica a migração incremental; o schema anterior do banco descartável é gerado por Prisma diff, não por replay integral de todas as migrações históricas.

## Pendências e riscos para etapas seguintes

1. ChatBox, Central de Agentes e botões de aprovação/configuração ainda não existem no frontend. A funcionalidade desta entrega é acessível por APIs autenticadas em homologação.
2. Não foi realizado teste na VPS, em PostgreSQL nativo multiprocesso ou de carga com muitas cooperativas. O limite global é conservador, mas CPU/RAM e planos de consulta devem ser medidos antes da ativação real.
3. Definir política de retenção/expurgo de conversas, resultados, propostas e auditoria antes do uso prolongado. Não há remoção automática nesta versão; evitar dados pessoais desnecessários em motivos.
4. Alertas seguem os critérios, limites e consistência do motor existente. Propostas são evidências do momento da análise e podem ficar desatualizadas; não dispensam conferência humana.
5. Cálculo geométrico não substitui planejamento por ruas. Geocodificação, trânsito, capacidade de veículo e todas as janelas operacionais não são resolvidos automaticamente.
6. Comandos não reconhecidos não são salvos como conversas nesta etapa. Não há IA generativa, ações autônomas nem ferramentas operacionais liberadas ao perfil municipal.
7. Ativação global, migração fora do banco descartável, publicação/merge na `main` e deploy dependem da próxima autorização. A etapa termina aqui.
