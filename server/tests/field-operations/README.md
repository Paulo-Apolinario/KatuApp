# Operações em campo e execuções agrupadas

A suíte usa PostgreSQL descartável em memória, fornecido pelo PGlite em 127.0.0.1:54329. Constrói a versão anterior do schema, cria uma rota e coleta históricas e aplica a migração real antes dos testes. Não usa o DATABASE_URL da VPS e não envia e-mails reais.

Ferramentas separadas do código de produção:

```bash
npm install --prefix /tmp/katua-validation @electric-sql/pglite @electric-sql/pglite-socket playwright @sparticuz/chromium
```

Após instalar as dependências e gerar o Prisma Client, executar a partir de KatuApp:

```bash
KATUA_VALIDATION_TOOLS=/tmp/katua-validation node server/tests/field-operations/run.mjs
```

Para incluir a interface com API real local, informe o frontend do Katua_Web, com suas dependências instaladas:

```bash
KATUA_VALIDATION_TOOLS=/tmp/katua-validation KATUA_PANEL_FRONTEND=/caminho/Katua_Web/frontend FIELD_UI=1 node server/tests/field-operations/run.mjs
```

KATUA_CHROMIUM_PATH permite indicar um Chromium existente; por padrão usa o executável do pacote de testes. Portas 54329, 3339 e 5179 devem estar livres. Os relatórios e imagens ficam no diretório das ferramentas. A base é descartada no encerramento.

Cenários: saída de rota, preparação já validada, timestamp de início e repetição, operação única por rota, coleta individual, rota avulsa, execução diária separada por data, paginação de grupos e pontos, sequência de visitas, busca de PEV/endereço avulso, filtro de colaborador participante, recebimento/conferência individual, perfis, isolamento entre cooperativas, validação de filtros e interface móvel.
