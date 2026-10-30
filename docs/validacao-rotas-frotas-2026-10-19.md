# Validação de rotas e frota — 19/10/2026

## Resultado

Os cenários locais listados abaixo passaram. A execução final terminou com código 0. Foram encontradas e corrigidas duas falhas: resultado de sucesso indevido em sincronização parcialmente rejeitada e edição de equipe impedida em rota sem data.

Esta validação não é uma observação em produção. Não houve deploy, alteração na VPS nem migração em banco de produção.

## Ambiente e fronteiras

- Código-base: KatuApp main 8bd85a6 e Katua_Web main 8e8a81d, mais as correções e testes deste relatório.
- API Fastify completa com Prisma e validação JWT reais. Usuários, cooperativas, motoristas, veículos, rotas e coletas foram criados exclusivamente para teste.
- Banco PGlite 0.5.10, PostgreSQL compilado para WebAssembly, exposto por pglite-socket 0.2.13 em TCP local. Não foram simuladas as consultas do Prisma nesses cenários.
- PGlite tem modelo de conexões diferente de PostgreSQL nativo. Não comprova concorrência, bloqueios, SSI ou isolamento entre processos de uma instalação nativa.
- Chromium com Playwright 1.62.1 para o painel React/Vite e para o aplicativo Expo Web. Viewports de desktop e de celular; viewport de celular não equivale a Android/iOS.
- Para a fila offline, serviços e repositórios originais do aplicativo foram executados com SQLite do Node 24, por um adaptador de acesso SQL. A perda de rede foi controlada no transporte; após reconexão, as operações foram enviadas à API local real. Isso não valida o módulo expo-sqlite nem a conectividade de um aparelho.
- Requisições externas do navegador foram bloqueadas. URLs da API de produção incorporadas pelo bundle Expo foram interceptadas e respondidas pela API local. Não foram utilizados tokens, banco ou contas da operação.

## Cenários executados

| Cenário | Resultado | Evidência e limite |
| --- | --- | --- |
| GET sem JWT; PATCH por DRIVER; acesso por outra cooperativa | Passou | HTTP 401/403/404 conforme fluxo; motorista de outra cooperativa rejeitado. |
| Concluir rota com coleta pendente | Passou | Rejeição pela API; nome e status originais preservados em nova consulta. |
| Concluir com COLLECTED e CANCELLED | Passou | Rota COMPLETED; coletas, motorista e veículo originais das coletas preservados. |
| Falha após atualizar rota e antes de atualizar coletas | Passou | Trigger SQL lançou exceção; transação desfez a edição da rota e manteve atribuições. Banco WASM, não teste de concorrência nativa. |
| Trocar motorista e veículo no painel | Passou | Formulário real, salvar, recarregar lista e nova consulta à API; nome e placa conferidos. Coleta COLLECTED manteve motorista anterior. |
| Remover motorista e veículo no painel | Passou | Formulário, recarga, indicação de vínculos ausentes e valores null na nova consulta. |
| Editar modelo de veículo no painel | Passou | Valor apareceu na lista após recarga e no GET posterior. |
| Rejeitar conclusão enfileirada offline | Passou após correção | Servidor manteve IN_PROGRESS; item continuou ERROR no SQLite; resultado geral success=false. |
| Sincronizar operação elegível após reconexão | Passou | Servidor confirmou COMPLETED; item sincronizado saiu da fila; nova consulta retornou SYNCED. |
| Trocar equipe em Expo Web | Passou após correção | Rota sem data; campo inicialmente vazio; seleção dos IDs, salvamento, recarga e GET confirmaram motorista/veículo. |
| Remover equipe em Expo Web | Passou | Seleções Sem motorista/Sem veículo, recarga, null no GET e preservação da coleta histórica. |

Os resultados brutos, sem credenciais, estão em [validacao-rotas-frotas-2026-10-19.json](validacao-rotas-frotas-2026-10-19.json). Há verificações agrupadoras no arquivo; não interpretar sua contagem como número de cenários independentes.

## Correções realizadas

### Sincronização parcialmente rejeitada

Arquivo: src/offline/syncEngine.ts.

Antes: processSyncItem registrava erro na fila, mas syncPendingOperations retornava success=true ao final, mesmo com rejeições.

Depois: êxitos e falhas são contabilizados; qualquer rejeição produz success=false e mensagem de falha parcial. Os demais itens continuam sendo processados. Itens rejeitados permanecem na fila; o cache de uma rota sincronizada recebe syncStatus=SYNCED.

Regressão: server/tests/sync-engine-contract.test.ts cobre erro parcial e sucesso integral. O comportamento também foi repetido no SQLite conectado à API local.

### Rota sem data não permitia editar equipe

Arquivo: app/(cooperativa)/rotas/[id].tsx.

Antes: startEdit preenchia a data usando o formatador de exibição. Uma data null virava “Não informada”, texto que a própria validação do formulário recusava.

Depois: uma data ausente inicia o campo vazio. A validação integrada em Expo Web confirmou troca e remoção da equipe sem adicionar uma data.

## Outros achados

A checagem completa de tipos do aplicativo foi executada e continua falhando em oito diagnósticos, também reproduzidos na cópia anterior às alterações de rotas:

- ScheduleStatus não exportado, usado em duas telas de agendamento da cooperativa.
- translateCollectionStatus não exportado, usado em quatro telas do motorista.
- MaterialType[] incompatível com RequestedScheduleMaterialInput[] no agendamento PF.
- stockItemId nullable incompatível com assinatura do serviço de destinação, já registrado anteriormente.

Não foram incluídas correções desses módulos nesta validação. O lockfile incompleto do painel permanece como pendência separada.

## O que ainda falta

1. Concorrência com PostgreSQL nativo, incluindo duas sessões/processos disputando a mesma rota/coleta. O ambiente local só permite UID root e não inicia PostgreSQL nativo; testes de rollback em PGlite não substituem esse cenário.
2. Dispositivo ou emulador Android/iOS: edição, armazenamento expo-sqlite, perda real de rede, retomada e ciclo de vida do aplicativo.
3. Isolamento integral do cache entre usuários/cooperativas, conflitos de edição offline e cadeia completa coleta → entrada → destinação → lote.
4. Publicação e observação na VPS, sob responsabilidade e autorização do usuário.

## Repetição dos testes

Os scripts ficam em server/tests/operational. O runner exige Node 24, dependências já instaladas nos projetos e ambos os repositórios disponíveis localmente. Ele gera um banco PGlite vazio em memória a partir do schema, cria apenas dados demonstrativos e encerra os serviços ao final. Não se conecta ao DATABASE_URL da operação.

Instale as dependências de teste em uma pasta temporária, sem adicioná-las aos projetos:

```bash
qa_tools="$(mktemp -d)"
npm install --prefix "$qa_tools" --ignore-scripts --no-package-lock --no-audit --no-fund @electric-sql/pglite@0.5.10 @electric-sql/pglite-socket@0.2.13 @sparticuz/chromium@153.0.0 playwright@1.62.1
```

Na raiz do KatuApp, execute:

```bash
KATUA_VALIDATION_TOOLS="$qa_tools" node server/tests/operational/run-local-validation.mjs
```

O caminho padrão do painel é ../Katua_Web/frontend. Se necessário, defina KATUA_WEB_DIR apontando para a pasta frontend. KATUA_PLAYWRIGHT_MODULE e KATUA_CHROMIUM_PATH permitem usar instalações existentes dessas ferramentas. Nesta execução foi usado o Chromium preparado no ambiente de testes; outros sistemas podem exigir suas dependências de execução.

O runner precisa das portas locais 54329, 3339, 5179 e 8089 disponíveis. O relatório JSON e as capturas ficam na pasta temporária indicada em REPORT_DIR. Essa pasta contém também credenciais descartáveis dos usuários demonstrativos e não deve ser enviada ao GitHub.

Regressões rápidas, a partir de KatuApp/server:

```bash
node --import tsx --test tests/route-vehicle-contract.test.ts tests/route-client-contract.test.ts tests/sync-engine-contract.test.ts
```

Passaram 17 testes, incluindo agrupador. No painel, os quatro testes de serviços e resumo da equipe continuaram passando. A checagem global de tipos permanece com as falhas anteriores listadas acima.
