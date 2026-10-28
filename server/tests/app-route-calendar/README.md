# Revisão do App e calendário operacional

Os testes usam dados descartáveis. Não acessam banco, sessão ou API da VPS. `run.mjs` constrói o schema Prisma em PostgreSQL em memória e fornece ao processo filho a conexão restrita a 127.0.0.1:54329. As telas da cooperativa no App não integram os cenários de interface.

Ferramentas de teste podem ser instaladas fora do projeto:

```bash
npm install --prefix /tmp/katua-validation @electric-sql/pglite @electric-sql/pglite-socket playwright @sparticuz/chromium
```

Com as dependências do App e do servidor instaladas e Prisma Client gerado, a partir da raiz KatuApp:

```bash
npm run test:app
KATUA_VALIDATION_TOOLS=/tmp/katua-validation node server/tests/app-route-calendar/run.mjs
```

Para testar o App web, exportar a versão atual para o diretório de teste e executar o navegador. As chamadas destinadas a vps.katua.com.br são integralmente substituídas pelo transporte controlado do teste:

```bash
EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir /tmp/katua-validation/app-review-dist
KATUA_VALIDATION_TOOLS=/tmp/katua-validation node server/tests/app-route-calendar/app-browser.mjs
```

Para validar o painel, instalar as dependências do frontend e indicar seu caminho:

```bash
KATUA_VALIDATION_TOOLS=/tmp/katua-validation KATUA_PANEL_FRONTEND=/caminho/Katua_Web/frontend node server/tests/app-route-calendar/panel-browser.mjs
```

O Chromium pode ser informado por KATUA_CHROMIUM_PATH; caso contrário é utilizado o executável do pacote de teste. Portas 5180, 5179 e 54329 devem estar livres. A suíte de modelo do calendário fica em Katua_Web: `node frontend/scripts/operational-calendar.test.mjs` a partir da raiz desse repositório. Relatórios e imagens dos testes de navegador são gerados no diretório das ferramentas. Não substituem validação em aparelho físico para GPS, câmera e suspensão/retomada do aplicativo.
