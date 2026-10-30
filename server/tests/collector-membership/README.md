# Validação do cadastro e edição de catadores

`run.mjs` cria PostgreSQL descartável em memória com PGlite, escuta somente em `127.0.0.1:54329` e define a conexão de teste do processo filho. Não usa o banco configurado na VPS. Constrói o schema anterior, insere um catador antigo e aplica a migração real antes dos testes da API.

Com as dependências do servidor instaladas e Prisma Client gerado, prepare as ferramentas separadamente:

```bash
npm install --prefix /tmp/katua-validation @electric-sql/pglite @electric-sql/pglite-socket playwright @sparticuz/chromium
```

Dentro de `server`, execute:

```bash
KATUA_VALIDATION_TOOLS=/tmp/katua-validation node tests/collector-membership/run.mjs
```

Para incluir a interface, instale também as dependências do painel e informe seu diretório:

```bash
KATUA_VALIDATION_TOOLS=/tmp/katua-validation KATUA_PANEL_FRONTEND=/caminho/Katua_Web/frontend COLLECTOR_UI=1 node tests/collector-membership/run.mjs
```

O navegador utiliza Chromium disponível em `KATUA_CHROMIUM_PATH` ou o executável fornecido por `@sparticuz/chromium`. As portas locais 3339, 5179 e 54329 devem estar disponíveis. Os relatórios e capturas ficam em `KATUA_VALIDATION_TOOLS`; a base de dados é descartada no encerramento. Os testes não enviam e-mails nem modificam senha real.
