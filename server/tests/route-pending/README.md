# Pendências de execução

Validação local, sem VPS ou credenciais reais:

```bash
KATUA_VALIDATION_TOOLS=/caminho/validation-tools ROUTE_PENDING=1 node server/tests/field-operations/run.mjs
```

O harness usa PostgreSQL descartável PGlite, aplica a migração nova sobre execução antiga e exercita HTTP real via Fastify inject. Inclui regressões de operações em campo. Evidência em `route-pending-api-results.json`.

Após exportar o Expo web para `KATUA_APP_DIST`:

```bash
KATUA_VALIDATION_TOOLS=/caminho/validation-tools KATUA_APP_DIST=/caminho/dist KATUA_CHROMIUM_PATH=/caminho/chromium node server/tests/route-pending/app-browser.mjs
```

O teste abre a tela real do catador e intercepta todas as chamadas da API. Os dados são demonstrativos; não há acesso à produção. Não substitui testes de sensores e conectividade em aparelho físico.

Painel (componentes reais, API interceptada com dados demonstrativos):

```bash
KATUA_VALIDATION_TOOLS=/caminho/validation-tools KATUA_PANEL_FRONTEND=/caminho/Katua_Web/frontend KATUA_CHROMIUM_PATH=/caminho/chromium node server/tests/route-pending/panel-browser.mjs
```
