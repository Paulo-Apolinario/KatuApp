# Analytics — Uso e adesão

## Entrega

- Painel: Analytics → Uso e adesão (`/analytics/participation/monitoring`), mantendo a senha adicional do Analytics. Cooperativa vê exclusivamente sua organização e contas com vínculo atual.
- Administração: `/analytics/monitoring`, disponível a contas já existentes de papel ADMIN, ativas e com credenciais prontas. A entrada normal do painel encaminha ADMIN para essa tela dedicada, sem abrir o menu operacional das cooperativas. Nenhuma conta foi criada, promovida ou teve senha alterada.
- Lista com município/documento informado, cadastro, habilitação conhecida, situação, sistemas observados no período, último login, última atividade, tempo ativo estimado, dias medidos e operações. Validade contratual não configurada é explicitamente indicada; não foi introduzido bloqueio por vencimento.
- Filtros de período (até 366 dias, sem data futura), cooperativa, município, acesso, sinal no período e última atividade há mais de 7/30/60 dias. O filtro de dias exclui datas desconhecidas. Busca não é pesquisa em dados de outra cooperativa.
- Detalhes paginados das contas, incluindo contas pendentes/inativas. Usuários sem vínculo persistente (PF) não recebem tempo atribuído arbitrariamente à cooperativa.
- Exportação de toda a seleção em Excel/PDF, com período e método. Máximo de 10.000 registros, com erro explícito acima do limite, sem corte silencioso. No detalhe são exportadas todas as contas da seleção.

## Datas e interpretação

Migração `20261123010000_analytics_access_monitoring` acrescenta três campos opcionais a User: `accessEnabledAt`, `firstLoginAt`, `lastLoginAt`. Registros anteriores permanecem nulos: createdAt e sinais de atividade não são convertidos em datas de login/habilitação.

A habilitação é registrada nas novas criações de acesso dos fluxos AuthService e na definição inicial de senha de uma conta pendente. Login é registrado somente após validação e assinatura da sessão, por senha, link de uso único ou sessão inicial de cadastro/ativação. GET /auth/me, senha incorreta e conta bloqueada não atualizam login.

Tempo usa o medidor existente AnalyticsUsageDaily: primeiro plano, interação recente e deduplicação diária por intervalos. Versões antigas e uso offline podem não emitir sinal. Não é jornada de trabalho; somar pessoas simultâneas pode ultrapassar a duração do relógio. Dias da cooperativa são datas distintas com sinal, não soma dos dias de cada conta.

Último login e atividade são históricos (maior data das contas atualmente vinculadas); tempo, dias e sistemas são do período. Histórico de atividade é restrito ao vínculo/cooperativa persistido, não transferido para outra organização.

Operações: coletas criadas excluem registros técnicos de bags MIXED_BAG; recebimentos contam Collection recebida/triada/concluída com receivedAt no período; triagens são eventos SORT de bags não estornados; saídas somam cada STOCK_DISPATCH consolidado uma vez e movimentos individuais de saída que não são filhos `bulk:`. Essas medidas não são somáveis como um total único de atendimentos.

## Atualização

Aplicar prisma migrate deploy e gerar o cliente Prisma antes de iniciar a API atualizada. Compilar API, reiniciar katua-api.service e compilar o painel. Não há alteração no app web/nativo nesta etapa; clientes já instrumentados continuam usando o endpoint de uso existente. Não exige configuração de serviço externo ou mudança de credenciais SINIR/fiscais.

A visão administrativa exige ADMIN real no banco; a senha temporária compartilhada do Analytics não concede acesso entre cooperativas. Este trabalho não designa um administrador e não implanta na VPS.

## Validação local

- Migração incremental sobre schema anterior: mantém contas antigas e datas desconhecidas.
- API Fastify/Prisma com banco PGlite descartável, sem banco/serviços de produção: permissões, isolamento de consulta/detalhe/exportação, filtros, dias distintos, paginação, exportação completa e contagem de saídas consolidadas sem duplicar lotes.
- Autenticação por senha/link, reenvio de link, senha incorreta, conta bloqueada, metadados de novos cadastros e preservação do histórico desconhecido.
- Navegador com APIs simuladas: ADMIN/COOPERATIVE, acesso protegido, desktop/mobile, tabelas, paginação, vazio, recuperação de falha e downloads reais Excel/PDF. Excel conferido com 21 contas distribuídas em duas páginas; PDF conferido como arquivo PDF.
- Regressões: phone-access e cooperative-intakes. TypeScript/build da API, lint direcionado e build do painel. Permanecem os avisos preexistentes de chunks Vite e fast refresh do contexto de autenticação.

Ferramentas locais externas ao produto: KATUA_VALIDATION_TOOLS com @electric-sql/pglite, @electric-sql/pglite-socket, playwright e @sparticuz/chromium. Executar `node server/tests/analytics-monitoring/run.mjs` na raiz KatuApp. Para UI, informar também KATUA_PANEL_DIST e executar `node server/tests/analytics-monitoring/browser.mjs`. O teste usa a porta local 54349; os outros ambientes são recusados.
