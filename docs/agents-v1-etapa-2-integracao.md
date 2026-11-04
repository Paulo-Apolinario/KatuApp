# KATUÁ Agents v1 — Integração da interface (Etapa 2)

04/11/2026. Plataforma criada e desenvolvida por **Paulo Roberto Apolinario da Silva** e **Nilton Felipe de Oliveira Braz**.

Branch local: `work/agents-v1-interface-20261104`, derivada da etapa 1 (`441c5c4`). Sem push, alteração da main ou deploy. A publicação permanece reservada para a conclusão e validação das três etapas.

## Complementos do backend

- `AgentConfig.automationsEnabled`: permite desligar agendamento mantendo análise manual disponível quando o agente está habilitado.
- `AgentConfig.notificationsEnabled`: controla avisos de novas propostas no InboxNotification existente. Propostas continuam sendo registradas; avisos anteriores permanecem intactos e não são reenviados ao reativar.
- `PATCH /agents/:agent/config` aceita os dois campos booleanos opcionais, além dos campos e proteções de versão/evento da etapa 1.
- `GET /agents/occurrences/:id`: consulta de contexto autenticada, perfil COOPERATIVE, com pertencimento à cooperativa; não resolve a ocorrência nem marca notificação como lida.
- A identidade do agente é retornada pela execução real. A interface consulta proposta + execução antes de apresentar contexto de notificações.

Migração incremental: `20261104030000_agents_ui_preferences`. Adiciona duas colunas booleanas com default true, preservando o comportamento anterior. A habilitação do agente continua false por padrão e o módulo global continua opt-in. Nenhum campo operacional foi modificado e nenhuma migração foi executada em produção.

O teste local aplica primeiro a migração da etapa 1, insere uma configuração anterior e aplica a migração desta etapa. Verifica que enabled=false, intervalo=90 e versão=7 permanecem iguais e que os dois novos defaults são true. Alertas e cooperativa anteriores também são preservados.

## Arquivos

Modificados: `server/prisma/schema.prisma`; `server/src/modules/agents/agents.config.ts`, `agents.schemas.ts`, `agents.execution.ts`, `agents.triggers.ts`, `agents.proposals.ts`, `agents.routes.ts`; `server/tests/agents/integration.ts`, `run.mjs`.

Criados: migração incremental e este relatório. Não houve alteração no App, em módulos operacionais ou no mecanismo existente de leitura de notificações.

## Verificações

- 66 cenários de backend aprovados: 62 da etapa 1 e quatro novos para preferências, validação e contexto autorizado.
- 25 cenários integrados da interface aprovados usando este backend real e banco descartável.
- Prisma validate, TypeScript e build do servidor aprovados.
- Banco de teste exclusivamente local: PGlite/socket em 127.0.0.1:54329. API para navegador em 127.0.0.1:3339.

O runner admite `AGENTS_UI=1`, `KATUA_AGENTS_UI_RUNNER`, `KATUA_PANEL_DIST` e `KATUA_VALIDATION_TOOLS` para executar o teste de navegador do painel ao final dos cenários de backend. A fixture contém somente contas descartáveis e não é versionada. Não há dependências novas na aplicação.

## Limites

Esta etapa habilita interface e decisões consultivas. Aprovar/rejeitar não executa rotas, coletas, pesos ou estoque. Não há IA generativa. Ficam pendentes a homologação em PostgreSQL nativo/aparelhos físicos, medição de carga e política de retenção já mencionadas na etapa 1.

O relatório completo da interface, inventário dos arquivos, capturas e resultados máquina-legíveis acompanham o painel em `docs/agents-v1-etapa-2.md` e `docs/agents-v1-etapa-2-validacao.json`. O frontend requer esta versão do backend para os novos controles; não deve ser ativado isoladamente em produção.
