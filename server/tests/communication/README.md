# Comunicação App, API e Painel

Validação local, sem VPS, e-mails reais ou contas de produção.

```bash
KATUA_VALIDATION_TOOLS=/caminho/validation-tools APP_RELIABILITY=1 RESIDENTIAL=1 ROUTE_PENDING=1 COMMUNICATION=1 node server/tests/field-operations/run.mjs
node server/tests/communication/app-refresh.cjs
node server/tests/communication/route-cache.cjs
node server/tests/extra-orders/offline.cjs
KATUA_VALIDATION_TOOLS=/caminho/validation-tools node server/tests/app-reliability/offline.cjs
```

O harness de API usa PGlite descartável em 127.0.0.1:54329 e HTTP Fastify inject. A falha de aviso provocada pelo trigger `communication_fail_notice` é esperada: comprova rollback da delegação. Não é equivalente a ensaio de carga PostgreSQL nativo.

Painel: componentes reais, transporte interceptado com dados de teste. Requer frontend instalado, Playwright e Chromium local. Valida notificações, encaminhamentos, leitura, edição preservada, atualização automática, telefone de 390px, timeout, 401 e resposta tardia de outra sessão.

```bash
KATUA_VALIDATION_TOOLS=/caminho/validation-tools KATUA_PANEL_FRONTEND=/caminho/frontend KATUA_CHROMIUM_PATH=/caminho/chromium node server/tests/communication/panel-browser.mjs
```

App: executar `tests/route-pending/app-browser.mjs` com `KATUA_APP_DIST` apontando para o export Expo atual. O teste usa transporte interceptado, distingue lista ativa e histórico e conserva coletas realizadas. `app-refresh.cjs` verifica que COOPERATIVE não instala listeners/timers novos. `route-cache.cjs` verifica que o resumo não apaga o roteiro offline e que o cache permanece isolado por conta.

Android/iPhone físico, instalação efetiva na VPS, rede real e notificações push em segundo plano não são comprovados por estes testes.
