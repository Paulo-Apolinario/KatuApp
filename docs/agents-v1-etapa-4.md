# KATUÁ Agents v1 — relatório final da Fase 4

Data: 04/11/2026. Desenvolvedores e criadores do KATUÁ: Paulo Roberto Apolinario da Silva e Nilton Felipe de Oliveira Braz.

## Resultado e escopo

Backend, interface e automações passaram pelas verificações descritas abaixo. Versão apta à homologação operacional. A integração é feita por avanço normal da `main`, preservando seus commits anteriores, após conferir novamente as referências remotas. Não houve acesso à VPS, deploy, execução de migrações em produção, reinício de serviços, alteração de Nginx ou edição de configuração de produção.

A branch de preparação nos dois repositórios é `work/agents-v1-release-20261104`. O SHA final da `main` é informado na entrega, pois incluir o SHA do próprio commit neste arquivo criaria referência circular. GitHub Actions da validação nativa: https://github.com/Paulo-Apolinario/KatuApp/actions/runs/41916578825 — sucesso, commit de código `4b6a24ab7f1c5e799b1d6c32a716f61617fb64fe`, artifact `agents-native-postgres-evidence` (13363579547).

## Funcionalidades entregues

- Agente de Coletas: lê solicitações reais, atrasos, prioridades, inconsistências e possibilidades de agrupamento; não modifica nem cancela registros.
- Agente de Rotas: lê programação, equipe, recursos e conflitos usando validadores existentes; gera recomendações sem alterar planejamento.
- Agente Gestor: usa dashboard e alertas para resumo operacional e recomendações.
- Motor determinístico de sete comandos, com variações simples e orientação explícita quando não reconhecido. Não há IA generativa, API paga ou modelo instalado.
- ChatBox único com identificação do agente, histórico por usuário, navegação, comandos rápidos, dados reais, links seguros e tratamentos de indisponibilidade/sessão.
- Central de Agentes com configuração, execuções, fila de eventos, ocorrências, propostas e decisões humanas. Aprovar proposta registra decisão; não executa mudanças operacionais.
- Integração complementar ao sino e às notificações existentes. Ler aviso não resolve ocorrência. Contexto histórico é identificado e reavaliado em propostas.
- Captura transacional persistente de eventos, consumo sem painel aberto, agrupamento, deduplicação, retentativas, recuperação e processamento periódico.

## Verificações e resultados

| Verificação | Resultado |
|---|---|
| Backend TypeScript `npm run check` | Aprovado localmente e em CI |
| Backend `npm run build` | Aprovado em CI |
| Prisma `generate` e `validate` | Aprovados em CI |
| Migrações incrementais sobre schema anterior e dados de teste existentes | Aprovadas em PostgreSQL nativo 16.13, dados preservados |
| Comandos/API/permissões/isolamento e regressão dos agentes | 66 aprovados, 0 falhas |
| Eventos, agendamento, concorrência e recuperação | 28 aprovados, 0 pendentes, 0 falhas |
| Chromium: interface real Vite + API local descartável | 27 aprovados, 0 falhas |
| Total de cenários distintos | **121 aprovados, 0 pendentes, 0 falhas** |
| Frontend lint | 0 erros, 8 avisos preexistentes |
| Frontend build Vite | Aprovado; permanece aviso de tamanho de bundle |
| Whitespace `git diff --check` | Aprovado |

As suítes de 66 casos foram repetidas localmente e no CI; não foram contadas duas vezes no total. Os 27 casos de interface usam Chromium em desktop/tablet/celular com dados da API real e PGlite descartável; falhas de transporte foram controladas. Não representam Safari/iOS ou Android nativo.

A pendência anterior de concorrência foi resolvida: dois processos independentes disputaram um lote no PostgreSQL nativo sem duplicação (cenário 15). Os arquivos das etapas anteriores preservam o histórico de quando esse caso ainda estava pendente; este relatório e o JSON da Fase 4 representam a validação atual.

Cobertura inclui JWT ausente/inválido, perfil municipal bloqueado, contas/permissões, duas cooperativas, dados inexistentes, comandos desconhecidos, comando idempotente e conflito, alteração do registro depois da proposta, proposta obsoleta, evento repetido/offline, transação revertida, desativação durante execução, limite diário e de tempo, retentativa terminal, concorrência, pausas de captura e integração com notificações. A interface cobre histórico, navegação, menu/sino, responsividade, teclado, logout, expiração, backend indisponível e isolamento. Evidências detalhadas: `agents-v1-etapa-4-validacao.json` e `agents-v1-etapa-4-ui.json`.

## Correções e revisão da Fase 4

Foi acrescentada uma validação isolada no GitHub Actions, sem segredos ou banco de produção. O primeiro ensaio falhou porque o pacote dos binários de PostgreSQL não inclui `psql`; o runner passou a usar `/usr/bin/psql`. A segunda execução completou a suíte e conferiu os totais de forma obrigatória, sem transformar cenários pendentes em sucesso. Também foram corrigidos os rótulos do ambiente das evidências para distinguir PostgreSQL nativo de PGlite. Não foi necessário alterar regras operacionais nesta revisão final.

A publicação foi feita pela conexão autenticada do GitHub porque o transporte HTTPS Git local não tinha credencial para push. Os commits não publicados foram materializados com os mesmos conteúdos/árvores, em sequência sobre a `main` remota, sem force push, exclusão de branch ou reescrita de histórico publicado.

| Etapa | Commit local | Commit publicado |
|---|---|---|
| Backend 1 | `441c5c4` | `a1d17a9ad48f88c100e313a1603e21a760c0658e` |
| Backend 2 | `283f044` | `87a255a5ba10b7b2de811e4e546b17474f54abc4` |
| Backend 3 | `8fe1fb9` | `4497f67ae394570c05176159fce2fc8f1b55266f` |
| Backend CI | `ab39803` | `4a3330991e6a4e43a4ae5c652867a14ca051dffe` |
| Backend correção CI | `200b960` | `4b6a24ab7f1c5e799b1d6c32a716f61617fb64fe` |
| Painel 2 | `e60770e` | `c390d1a3a48a4ec0b8ac30a6efa680bb596b39a6` |
| Painel 3 | `bc7804b` | `7073f21fd66f3f0c9941226545366e9aaebe697f` |

Os arquivos locais não relacionados `app/eas.json` e `src/components/maps/MapBottimSheet.tsx` ficaram fora dos commits.

## Migrações e tabelas

1. `20261104020000_agents_v1`: AgentConfig, AgentRun, AgentConversation, AgentMessage, AgentProposal, AgentAuditEvent, enums e índices.
2. `20261104030000_agents_ui_preferences`: preferências de automação e notificação; não habilita agentes desabilitados.
3. `20261104040000_agents_operational_events`: AgentEvent, AgentEventDelivery, origem EVENT, campos de frequência e nove gatilhos incrementais.

Modelos existentes preservados: SystemAlert, InboxNotification, CooperativeSettings e registros operacionais. Migrações não contêm limpeza/reset de dados. Aplicação em banco descartável confirmou preservação de cooperativa, alerta e configuração anterior. Uso em produção exige conferir todas as migrações pendentes do ambiente e o usuário proprietário/privilégios dos gatilhos.

## APIs autenticadas

| Método | Caminho | Uso |
|---|---|---|
| GET | `/agents` | Catálogo e configuração |
| PATCH | `/agents/:agent/config` | Habilitação e frequências |
| POST | `/agents/:agent/run` | Análise manual |
| POST | `/agents/commands` | Comando estruturado/texto simples |
| GET | `/agents/runs` e `/agents/runs/:id` | Histórico e detalhes |
| GET | `/agents/conversations` | Conversas do usuário |
| GET | `/agents/conversations/:id/messages` | Mensagens |
| GET | `/agents/proposals` e `/agents/proposals/:id` | Propostas e atualidade |
| POST | `/agents/proposals/:id/decision` | Aprovar/rejeitar sem execução operacional |
| GET | `/agents/occurrences` e `/agents/occurrences/:id` | Ocorrências |
| GET | `/agents/events` | Fila persistente |
| GET | `/agents/audit` | Auditoria |

JWT, Zod, conta ativa, perfil COOPERATIVE e pertencimento são conferidos no servidor. Não há executor para alterar rota, coleta, peso, estoque ou destinação. MUNICIPAL_MANAGER não recebe acesso às ferramentas.

## Execução, segurança e consumo

Uma mudança operacional confirmada gera evento e entregas na mesma transação. Worker do backend lê pequenos lotes; consulta o estado atual; executa análise com trava e lease; persiste execução, propostas e avisos com deduplicação. Agendamento periódico cobre o estado atual mesmo sem eventos recentes. Não há consumo disparado por InboxNotification, evitando ciclos.

Agentes globalmente desligados por padrão (`AGENTS_ENABLED` só aceita `true`) e individualmente desabilitados por padrão. Uma análise global concorrente, lote de 20 entregas, teto de 10 análises/minuto e 100/dia por cooperativa; intervalo periódico inicial de 60min, agrupamento de eventos em 5min, worker a cada 60s. Três tentativas, recuperação de lease e histórico de falha. O intervalo pode ser configurado dentro dos limites publicados. Desligar automações da cooperativa interrompe novas capturas; desligar só o worker global deixa os gatilhos capturando para configurações já habilitadas.

Não foram instalados Redis, Ollama, modelos locais ou serviços obrigatórios adicionais. A suíte incluiu mil solicitações, limites de saída/lote e uso do índice da fila. Medições locais anteriores estão no relatório da etapa 3; não são garantia de capacidade da VPS de 1 vCPU e 1,9 GB. O CI usa outra máquina. É necessário observar CPU, RAM, backlog e disco na homologação com volume real.

## Limitações e riscos restantes

- Não há falhas críticas conhecidas nas suítes desta entrega. A homologação com usuários e dados reais ainda é necessária.
- Interrupção foi validada pela recuperação de estado/lease persistente; indisponibilidade do banco foi injetada. Não foi realizado kill/restart real do PostgreSQL nativo durante gravações.
- Timeout de resposta não cancela consultas SQL já em andamento; fencing/lease impede confirmação tardia e execução concorrente órfã dentro das regras testadas.
- Gatilhos participam da transação operacional. Falha de privilégio, migração ou indisponibilidade das tabelas pode impedir uma gravação; há SQL específico de pausa/retomada, sem eliminar dados.
- Retenção/crescimento de auditoria e eventos precisa de acompanhamento; não há limpeza destrutiva automática nesta versão. O teto diário pode adiar análises em cooperativas muito movimentadas.
- Permanecem 8 avisos antigos do lint e aviso de bundle do painel. Não houve refatoração geral fora do escopo.
- Não foi feita auditoria ou regressão exaustiva de cada fluxo preexistente; os testes cobrem o módulo complementar e seus pontos de integração.

## Atualização e rollback

Leia `agents-v1-atualizacao-vps.md`: contém comandos separados para conferência, backup privado PostgreSQL/configuração/artefato estático, atualização em main, Prisma migrate deploy, builds, systemd, ativação gradual e reversão de código/captura sem apagar dados. **Os comandos foram apenas redigidos; não foram executados na VPS.** Não restaurar banco sobre produção como rollback automático. Não usar Prisma reset/db push para esta entrega.

## Inventário backend — A criado, M modificado

| Situação | Arquivo |
|---|---|
| A | `.github/workflows/agents-validation.yml` |
| A | `docs/agents-v1-etapa-1.md` |
| A | `docs/agents-v1-etapa-2-integracao.md` |
| A | `docs/agents-v1-etapa-3-validacao.json` |
| A | `docs/agents-v1-etapa-3.md` |
| A | `docs/agents-v1-validacao-2026-11-04.json` |
| M | `server/.env.example` |
| A | `server/prisma/migrations/20261104020000_agents_v1/migration.sql` |
| A | `server/prisma/migrations/20261104030000_agents_ui_preferences/migration.sql` |
| A | `server/prisma/migrations/20261104040000_agents_operational_events/migration.sql` |
| A | `server/prisma/rollback/agents-events-pause.sql` |
| A | `server/prisma/rollback/agents-events-resume.sql` |
| M | `server/prisma/schema.prisma` |
| M | `server/src/app.ts` |
| A | `server/src/modules/agents/agents.audit.ts` |
| A | `server/src/modules/agents/agents.collections.ts` |
| A | `server/src/modules/agents/agents.commands.ts` |
| A | `server/src/modules/agents/agents.config.ts` |
| A | `server/src/modules/agents/agents.event-lifecycle.ts` |
| A | `server/src/modules/agents/agents.events.ts` |
| A | `server/src/modules/agents/agents.execution.ts` |
| A | `server/src/modules/agents/agents.freshness.ts` |
| A | `server/src/modules/agents/agents.manager.ts` |
| A | `server/src/modules/agents/agents.permissions.ts` |
| A | `server/src/modules/agents/agents.proposals.ts` |
| A | `server/src/modules/agents/agents.recovery.ts` |
| A | `server/src/modules/agents/agents.request-sources.ts` |
| A | `server/src/modules/agents/agents.routes-analysis.ts` |
| A | `server/src/modules/agents/agents.routes.ts` |
| A | `server/src/modules/agents/agents.schemas.ts` |
| A | `server/src/modules/agents/agents.tools.ts` |
| A | `server/src/modules/agents/agents.triggers.ts` |
| A | `server/src/modules/agents/agents.types.ts` |
| M | `server/src/modules/settings/settings.alerts.ts` |
| M | `server/src/server.ts` |
| A | `server/tests/agents-events/integration.ts` |
| A | `server/tests/agents-events/native-db.mjs` |
| A | `server/tests/agents-events/worker.ts` |
| A | `server/tests/agents/integration.ts` |
| A | `server/tests/agents/run.mjs` |

## Inventário painel — A criado, M modificado

| Situação | Arquivo |
|---|---|
| A | `docs/agents-v1-etapa-2-validacao.json` |
| A | `docs/agents-v1-etapa-2.md` |
| A | `docs/agents-v1-etapa-3-evidence/historical-context.png` |
| A | `docs/agents-v1-etapa-3-validacao.json` |
| A | `docs/agents-v1-etapa-3.md` |
| A | `docs/agents-v1-evidence/desktop.png` |
| A | `docs/agents-v1-evidence/mobile.png` |
| M | `frontend/src/components/BarChart.jsx` |
| M | `frontend/src/components/Sidebar.jsx` |
| M | `frontend/src/components/WasteCollectionChart.jsx` |
| A | `frontend/src/components/agents/AgentChat.jsx` |
| A | `frontend/src/components/agents/AgentsProvider.jsx` |
| A | `frontend/src/components/agents/AnalysisResult.jsx` |
| A | `frontend/src/components/agents/ProposalCard.jsx` |
| A | `frontend/src/components/agents/agents.css` |
| A | `frontend/src/components/agents/agentsContext.js` |
| A | `frontend/src/components/agents/agentsFormat.js` |
| M | `frontend/src/layouts/AdminLayout.jsx` |
| M | `frontend/src/pages/Notifications.jsx` |
| A | `frontend/src/pages/agents/AgentsCenter.jsx` |
| M | `frontend/src/routes/index.jsx` |
| A | `frontend/src/services/agentsService.js` |
| M | `frontend/src/services/apiClient.js` |
| A | `tests/agents/browser.mjs` |

## Arquivos adicionais desta entrega final — ambos os repositórios

- `docs/agents-v1-etapa-4.md`: este relatório.
- `docs/agents-v1-etapa-4-validacao.json`: evidência nativa e totais finais.
- `docs/agents-v1-etapa-4-ui.json`: casos e resultados da interface.
- `docs/agents-v1-atualizacao-vps.md`: comandos manuais para atualização, backup e rollback.
