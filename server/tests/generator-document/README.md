# CPF/CNPJ do gerador cadastrado

A partir da raiz do App, após instalar dependências do servidor e gerar Prisma Client:

```bash
KATUA_VALIDATION_TOOLS=/caminho/validation-tools APP_RELIABILITY=1 RESIDENTIAL=1 ROUTE_PENDING=1 COMMUNICATION=1 GENERATOR_DOCUMENT=1 node server/tests/field-operations/run.mjs
```

O runner remove a coluna nova do schema inicial, cria um gerador antigo com produção e aplica a migração real. Usa PGlite local em 127.0.0.1:54329, uma conexão Prisma e dados demonstrativos; não utiliza o banco de produção. A restrição única é exercitada inclusive por dois envios simultâneos. Isso não substitui teste de carga PostgreSQL nativo.

Para adicionar as telas reais do Painel ao mesmo banco/API local:

```bash
KATUA_VALIDATION_TOOLS=/caminho/validation-tools KATUA_PANEL_FRONTEND=/caminho/frontend KATUA_CHROMIUM_PATH=/caminho/chromium APP_RELIABILITY=1 RESIDENTIAL=1 ROUTE_PENDING=1 COMMUNICATION=1 GENERATOR_DOCUMENT=1 GENERATOR_DOCUMENT_UI=1 node server/tests/field-operations/run.mjs
```

O teste de navegador bloqueia servidores externos e controla apenas o mapa; cadastro e atualização são processados pela API e banco locais reais. Inclui cadastro CPF/CNPJ, máscara alfanumérica, rejeição, classificação, pesquisa, edição legada, documento repetido e tela de 390px. Os resultados e imagens ficam na pasta das ferramentas.

Validação de formato e dígitos, executada a partir de server:

```bash
KATUA_PANEL_FRONTEND=/caminho/frontend node --import tsx tests/generator-document/unit.ts
```

CPF/CNPJ válido aqui significa formato e dígitos verificadores consistentes, sem consulta de titularidade ou situação cadastral.
