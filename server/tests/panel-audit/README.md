# Auditoria funcional do painel — 04/11/2026

A matriz separa testes de interface de testes das regras de negócio acessadas pelo painel. Usa Chromium em 1440 × 1000 e 390 × 844, Fastify/Prisma reais e um banco PostgreSQL descartável via PGlite. Não utiliza dados da VPS. As buscas externas de mapa não dependem de serviços reais; o cadastro de gerador tem um mapa controlado no navegador. Não envia e-mails reais nem documentos oficiais.

## Cobertura

- 56 telas do painel da cooperativa, com cinco verificações por tela: abertura, links/ações, recarregamento direto, celular/menu e falha de consulta ou validação inicial de formulário.
- 19 famílias de cadastro, com cinco situações por família: dados válidos, dados inválidos, duplicidade/repetição/vínculos, edição e isolamento/controle de versão. Inclui residencial cadastrado por CPF, pequeno por CNPJ, grande gerador, catador, motorista, veículo, PEV, rota, rota fixa, equipe, catálogo, lote, manutenção, entregador, registro documental do veículo e documentos de quatro titulares.
- Cinco situações adversas em cada grupo: recebimento, destinação, cadastro e solicitação.
- Dez situações para cada grupo operacional: geradores, solicitações/coletas, catadores, rotas, motoristas e veículos.
- Formulários reais, os seis destinos, PDFs de cadastro individual/todos, relatórios PDF/Excel, persistência de filtros, buscas e recuperação de sessão.
- Regressões adicionais em `waste-completion/browser.mjs` e `service-documents/browser.mjs`, executadas separadamente com o mesmo servidor descartável.

## Execução

Na raiz do App/servidor, depois de gerar o build do painel com `VITE_API_BASE_URL=https://vps.katua.com.br`:

```bash
export KATUA_VALIDATION_TOOLS=/caminho/validation-tools
export KATUA_PANEL_DIST=/caminho/do/painel/frontend/dist
export PANEL_AUDIT_UI=1 INTAKE_DELIVERERS=1 FIELD_MEETING=1 COOPERATIVE_FIELD=1 SERVICE_DOCUMENTS=1 STOCK_CODES=1 WASTE_USABILITY=1 WASTE_COMPLETION=1 ROUTE_PENDING=1
PANEL_AUDIT_PHASE=navigation PANEL_AUDIT_START=0 PANEL_AUDIT_END=17 node server/tests/field-operations/run.mjs
PANEL_AUDIT_PHASE=navigation PANEL_AUDIT_START=17 PANEL_AUDIT_END=34 node server/tests/field-operations/run.mjs
PANEL_AUDIT_PHASE=navigation PANEL_AUDIT_START=34 PANEL_AUDIT_END=50 node server/tests/field-operations/run.mjs
PANEL_AUDIT_PHASE=navigation PANEL_AUDIT_START=50 PANEL_AUDIT_END=56 node server/tests/field-operations/run.mjs
PANEL_AUDIT_PHASE=business node server/tests/field-operations/run.mjs
```

Executar os lotes em sequência. Cada execução cria e descarta o próprio banco. Não reconstruir a pasta `dist` durante um lote, pois o navegador está servindo seus arquivos. O diretório de ferramentas precisa de Playwright, Chromium em `/tmp/katua-pev-browser`, PGlite e pglite-socket. O runner limita explicitamente o banco a `127.0.0.1:54329` e sobe a API em 3339 e o painel estático em 5181.

Os resultados ficam em `panel-audit-ui-evidence/results-{fase}-{início}.json`. Para consolidar retestes, usar o resultado mais recente por ID, sem somar duas vezes o mesmo caso. Os dados consolidados e os achados desta entrega estão em `docs/auditoria-painel-2026-11-04.md` e `docs/validacao-painel-2026-11-04.json`.

O servidor possui duas verificações adicionais de preparação: indisponibilidade do banco durante a autenticação retorna 503; equipe permite cadastro sem conta no App, mas rejeita catador inativo ou conta desativada. Podem ser executadas sem navegador com `PANEL_AUDIT_API=1` e os mesmos flags de preparação.
