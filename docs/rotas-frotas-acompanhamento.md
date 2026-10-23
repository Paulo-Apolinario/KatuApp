# KATUÁ — rotas e frotas

Atualização: 19/10/2026. Referência: main de KatuApp e Katua_Web.

## Escopo e autorização

Mudanças incrementais no GitHub autorizadas pelo responsável pelo projeto. Deploy, VPS, migrações de produção e exclusões de dados não fazem parte desta entrega. Decisões operacionais ainda abertas não foram introduzidas por suposição.

## Etapa 1 — contratos e persistência

Implementado:

- PATCH /vehicles/:id para placa, modelo, marca, ano, capacidade, motorista e status. Somente COOPERATIVE; consulta do veículo e validação do motorista limitadas à cooperativa autenticada. Placa duplicada retorna 409; campos inválidos, desconhecidos e pedido vazio são rejeitados.
- Consultas de veículos incluem driver com id, name e status, sem expor a relação completa do usuário.
- Painel usa o PATCH geral para edição completa e mostra erros de domínio. A ação de exclusão foi substituída por Inativar, com texto explícito e preservação do cadastro. A inativação não cancela nem reatribui rotas existentes; os bloqueios de novas atribuições serão tratados na etapa de disponibilidade.
- PATCH /routes/:id aceita status junto aos campos da rota, dentro da mesma transação. O endpoint dedicado de status continua compatível e usa a mesma implementação e regra de cancelamento existente.
- Omissão preserva; null limpa campos opcionais; stops: [] limpa explicitamente as paradas. Cadastro continua omitindo opcionais vazios.
- Compatibilidade motorista/veículo considera o par final em alterações parciais. Rota e atribuições das coletas PENDING/IN_PROGRESS são gravadas em transação Serializable. Conflitos P2034 retornam 409, com orientação para recarregar. Isso não implementa ainda exclusividade de recursos entre rotas diferentes.
- Coletas COLLECTED e posteriores não recebem alterações de motorista/veículo pela edição da rota. A regra de cancelamento existente foi preservada até a decisão do marco operacional.
- Datas como 31/02 são rejeitadas. Paradas dos dois formulários do app passam a usar uma por linha, mantendo vírgulas dentro do endereço; não há migração automática de dados antigos fragmentados.

Arquivos de código alterados no KatuApp:

- server/src/modules/vehicles/vehicle.routes.ts
- server/src/modules/vehicles/vehicle.controller.ts
- server/src/modules/vehicles/vehicle.schemas.ts
- server/src/modules/vehicles/vehicle.service.ts
- server/src/modules/routes/route.schemas.ts
- server/src/modules/routes/route.controller.ts
- server/src/modules/routes/route.service.ts
- app/(cooperativa)/rotas/novo.tsx
- app/(cooperativa)/rotas/[id].tsx
- server/tests/route-vehicle-contract.test.ts

Arquivos alterados no Katua_Web:

- frontend/src/services/vehicleService.js
- frontend/src/services/routeService.js
- frontend/src/pages/vehicle-management/EditVehicle.jsx
- frontend/src/pages/vehicle-management/VehicleList.jsx
- frontend/src/components/modal/DeleteModal.jsx (textos configuráveis; padrões preservados para os outros consumidores)
- frontend/tests/edit-contracts.test.mjs

## Verificações executadas

- Backend: npm ci --ignore-scripts; npx prisma generate; npm run build — passaram. Nenhuma migração executada.
- Em KatuApp/server: node --import tsx --test tests/route-vehicle-contract.test.ts — 8 testes incluindo o teste agrupador. Fastify inject com autenticação e persistência simuladas. Casos: edição completa seguida de GET, null/omissão, placa duplicada, dados inválidos, motorista de outra cooperativa, perfil DRIVER, par final em PATCH parcial, status, datas inválidas, rollback simulado, preservação de coleta COLLECTED e conflito P2034 simulado.
- Em Katua_Web/frontend: node --test tests/edit-contracts.test.mjs — 2 testes dos payloads enviados pelos serviços web. Não são testes de navegador.
- Painel: build e ESLint dos cinco arquivos de código alterados passaram. npm ci falha devido a entradas ausentes no lockfile; para o build local foi usado npm install --ignore-scripts --no-package-lock. Lockfile não foi alterado.
- App: análise sintática/transpilação dos dois TSX passou. Não foi executado build Expo nem teste em dispositivo.
- npm run check do backend falha com TS2345 em collection-waste-destinations.controller.ts:122: stockItemId aceita null no schema, mas a assinatura do serviço restringe a string. A mesma falha foi reproduzida em uma cópia do HEAD anterior às alterações. Nenhum diagnóstico novo nos módulos alterados.

## Validação operacional — registro das etapas 1 e 2

Até a etapa 2, não haviam sido utilizados banco integrado ou navegador autenticado. Os testes locais adicionais e seus limites estão documentados na etapa 3 ao final e no relatório de validação vinculado abaixo. A simulação de transação das etapas anteriores não comprova isolamento do PostgreSQL nem ausência de conflitos entre processos.

Em ambiente de desenvolvimento isolado, após integrar backend e painel:

1. Editar todos os campos de um veículo, salvar, recarregar a página e conferir os valores e o motorista. Limpar marca, ano e motorista. Conferir placa duplicada, capacidade negativa e acesso por outra cooperativa.
2. Editar rota, limpar campos opcionais, manter paradas omitidas e remover paradas explicitamente. Alterar status junto aos dados; testar cancelamento rejeitado com coletas ativas sem persistência parcial.
3. Provocar falha e conflito em transação real e verificar rota/coletas; testar duas sessões concorrentes. Confirmar que coletas já coletadas preservam a atribuição.
4. No app, editar um endereço com vírgula e confirmar que permanece uma parada. Conferir dados antigos já fragmentados, sem correção automática.
5. Inativar veículo pela ação nomeada, recarregar e conferir que cadastro e histórico permanecem; reativação continua disponível na edição.

## Backlog

Estados utilizados: a confirmar, confirmado, em implementação, validado, pendente de publicação. Evidência estática e testes simulados não equivalem a validação operacional.

| Item | Estado | Prioridade | Evidência / impacto / dependência |
| --- | --- | --- | --- |
| Edição de veículos/rotas no painel e API | validado | P0 | Chromium, recarga e nova consulta a Fastify/Prisma/PGlite passaram. Limites do banco WASM abaixo. |
| Edição da equipe no app nativo | em implementação | P0 | Expo Web passou com recarga; Android/iOS ainda não executados. |
| Testes de contrato e regressão | validado | P0 | Etapa 3: 17 testes de serviços/contrato (inclui agrupador) e 4 web passaram, com limites documentados. |
| Estados COLLECTED/RECEIVED/SORTING e contadores | validado | P0 | Testes de contrato e integração local passaram; dispositivo nativo ainda pendente. |
| Encerramento da rota ao finalizar em campo | validado | P0 | API com PGlite confirmou conclusão com cancelamentos mistos e bloqueio com pendências, sem alterar coletas. Disponibilidade completa segue em item separado. |
| Exclusividade entre rotas, disponibilidade e vínculos encerrados | confirmado | P0 | Regras ainda incompletas; transação desta etapa não resolve dupla atribuição entre rotas. |
| Atribuições antigas | confirmado | P1 | Telas antigas ainda registradas. Uso real e funcionalidades a preservar: a confirmar. |
| Indicador totalColetado | confirmado | P1 | Valor artificial zero no app; depende de agregação real e período definido. |
| Seleção de rota/veículo atual | a confirmar | P1 | Revisão detalhada no app ainda necessária. |
| Manutenção, documentos e bloqueios | a confirmar | P1 | Confirmar contratos e definir situações de alerta/bloqueio com operação. |
| Offline, cache e permissões transversais | a confirmar | P0 | Isolamento e conflitos completos não cobertos por esta etapa. |
| Paradas estruturadas e roteirização | a confirmar | P2 | Separador corrigido; sequência, ruas, ETA e serviços externos ainda não implementados. |
| Tipos do app: exportações e materiais de agendamento | confirmado | P1 | Checagem completa reproduziu falhas de ScheduleStatus, translateCollectionStatus e MaterialType, também na base anterior. Escopo separado. |
| Concorrência em PostgreSQL nativo | a confirmar | P0 | Não executada: ambiente só dispõe de UID root e não inicia PostgreSQL nativo. PGlite não substitui este teste. |
| Execução em Android/iOS | a confirmar | P0 | Nenhum dispositivo/emulador disponível. Expo Web não equivale a execução nativa. |
| Sincronização informa falhas parciais | validado | P0 | Erro confirmado e corrigido na etapa 3; rejeição e sucesso mistos testados com SQLite e API local. |
| Edição da equipe em rota sem data | validado | P0 | Campo de data deixava texto de exibição impedir salvamento; corrigido e validado em Expo Web. |
| Publicação das etapas 1–3 na VPS | pendente de publicação | P0 | Código no GitHub; nenhuma ação na VPS executada. Publicação depende do responsável. |
| Falha prévia de tipos em destinação | confirmado | P1 | TS2345 com stockItemId nullable. Escopo diferente; apresentar correção antes de implementar. |
| Lockfile incompleto do painel | confirmado | P1 | npm ci falha antes de qualquer alteração. Avaliar reparo próprio e validar instalação reproduzível. |

## Continuidade

A validação local integrada foi executada na etapa 3 abaixo. Restam concorrência em PostgreSQL nativo e Android/iOS. O marco de encerramento está definido na etapa 2. Demais ajustes funcionais permanecem no backlog. Nenhum deploy, migração em produção ou exclusão de dados operacionais foi executado.


## Etapa 2 — encerramento em campo e edição da equipe

Decisão do responsável: o encerramento da rota ocorre mediante a finalização das coletas, sem aguardar recebimento físico, triagem ou destinação. A conclusão continua sendo uma ação manual; não foi introduzido encerramento automático.

Implementação:

- Ao pedir COMPLETED no PATCH geral ou dedicado, a transação exige ausência de PENDING/IN_PROGRESS e ao menos uma coleta em COLLECTED, RECEIVED, SORTING ou COMPLETED. Coletas CANCELLED não impedem conclusão; rota vazia ou só com cancelamentos não é considerada executada. Criar uma rota já concluída não contorna a regra.
- Nenhuma transição de status da coleta é provocada pela conclusão da rota. Recebimento e destinação continuam separados. Concluir a rota não limpa motorista/veículo nem altera o status cadastral do veículo; preserva-se a identificação da equipe. Disponibilidade/exclusividade completa dos recursos continua no backlog.
- activeCollections passa a significar coletas a executar em campo (PENDING/IN_PROGRESS). Contadores individuais de COLLECTED/RECEIVED/SORTING e fieldCompletedCollections foram adicionados sem alterar o significado de completedCollections, que continua COMPLETED.
- Adição/remoção de coletas na rota usa transação Serializable, rejeita rotas encerradas e preserva vínculos das coletas que já finalizaram em campo. Permissões COOPERATIVE e isolamento por cooperativa permanecem.
- Painel mostra nome do motorista e veículo (marca/modelo/placa) junto ao nome da rota e oferece a ação Editar equipe e rota. A edição mostra a equipe atualmente salva e informa conflitos entre o motorista escolhido e o vínculo cadastral do veículo.
- App mostra a equipe no resumo com botão Editar motorista e veículo. Corrigidos os IDs iniciais e envio de null ao remover vínculos. A edição não obriga preencher data/paradas opcionais para alterar a equipe.
- App preserva estados pós-coleta, mostra finalizações em campo e informa alterações de status offline como pendentes de confirmação. Trata-se de ajuste pontual: isolamento integral de cache/contas e tratamento completo de conflitos da fila continuam pendentes.
- Filtro de motorista sem resultados deixa de retornar todas as rotas.

Arquivos novos/alterados nesta etapa no KatuApp:

- server/src/modules/routes/route.service.ts
- server/src/modules/routes/route.controller.ts
- server/tests/route-vehicle-contract.test.ts
- server/tests/route-client-contract.test.ts
- src/services/routeService.ts
- app/(cooperativa)/rotas/[id].tsx
- app/(cooperativa)/rotas/index.tsx
- docs/rotas-frotas-acompanhamento.md

No Katua_Web:

- frontend/src/components/RouteAssignmentSummary.jsx
- frontend/src/pages/route-management/RouteList.jsx
- frontend/src/pages/route-management/EditRoute.jsx
- frontend/tests/route-assignment-summary.test.mjs

Verificações da etapa 2:

- Em KatuApp/server: node --import tsx --test tests/route-vehicle-contract.test.ts tests/route-client-contract.test.ts — 15 testes passaram (inclui agrupador). Persistência, autenticação, rede e fila simuladas; não usa banco nem dispositivo reais.
- Em Katua_Web/frontend: node --test tests/edit-contracts.test.mjs tests/route-assignment-summary.test.mjs — 4 testes passaram. Inclui renderização React em HTML para presença de motorista, modelo/placa e indicação de vínculos ausentes, sem teste visual de navegador.
- Builds do backend e painel passaram; ESLint dos três arquivos de interface web da etapa passou. App: transpilação/análise sintática dos arquivos alterados passou, sem build Expo completo.
- A checagem completa de tipos do backend continua impedida apenas pelo erro prévio TS2345 de destinação, já documentado. O lockfile do painel permanece com a pendência anterior.

Validação operacional pendente: recarregar painel após trocar/remover motorista/veículo; repetir no app com IDs e relações; concluir rota com todas as coletas finalizadas e cancelamentos mistos; verificar bloqueio quando houver pendências; conferir os vínculos e estados pós-coleta; simular rejeição e reconexão offline; testar concorrência com PostgreSQL real. Não houve deploy, alteração na VPS ou observação em produção.


## Etapa 3 — validação integrada em desenvolvimento

Autorização do responsável: executar os cenários operacionais pendentes, sem deploy. Foram usados dados demonstrativos e credenciais geradas só para teste. Chamadas do navegador foram limitadas ao ambiente local; as URLs de produção presentes no bundle Expo foram interceptadas e atendidas pela API local, sem tráfego para a VPS.

Resultados e limites: [relatório de validação](validacao-rotas-frotas-2026-10-19.md) e [resultados das verificações](validacao-rotas-frotas-2026-10-19.json).

Passaram em integração local: troca/remoção da equipe e edição de veículo no painel com recarga; troca/remoção da equipe em Expo Web com recarga; consultas posteriores ao banco; conclusão com COLLECTED e CANCELLED sem mudar o histórico; bloqueio por pendências sem gravação parcial; JWT, perfil DRIVER e isolamento por cooperativa; rollback provocado por trigger SQL; fila offline com SQLite, rejeição do servidor e reconexão.

Duas falhas foram encontradas e corrigidas durante a execução:

1. src/offline/syncEngine.ts informava success=true mesmo com itens ERROR. Agora informa falha parcial e contagens de êxitos/erros; itens rejeitados permanecem na fila, e confirmações bem-sucedidas são marcadas SYNCED no cache.
2. app/(cooperativa)/rotas/[id].tsx usava o texto de exibição “Não informada” como data no formulário de edição. Agora uma data ausente entra como campo vazio, permitindo editar a equipe sem inventar uma data.

Foram adicionados server/tests/sync-engine-contract.test.ts e os arquivos server/tests/operational/local-server.ts, run-local-validation.mjs e offline-checks.mjs para repetir a validação isolada. Nenhuma dependência de produção foi alterada.

Não considerar concluídos: concorrência em PostgreSQL nativo, execução Android/iOS, isolamento integral de cache entre contas e validação completa da cadeia entrada/destinação/lote. Permanecem sem implementação os demais itens funcionais do backlog. Não houve deploy, migração em produção nem uso de contas/dados operacionais.


## Correção complementar — avisos de cadastro e login (19/10/2026)

Autorização explícita do responsável para implementar, testar e salvar as correções no GitHub; atualização da VPS será feita pelo responsável.

Problemas confirmados por leitura da main:

- Cadastro público do app usava Alert.alert para o sucesso e dependia do botão OK para navegar. Esse diálogo não é implementado pelo React Native Web, impedindo a confirmação e o encaminhamento no navegador.
- Login do painel chamava toast.error, mas o Toaster só existia no AdminLayout autenticado. A tela pública não tinha o componente que desenha os avisos. Respostas com error também não eram consideradas na mensagem do login.

Alterações:

- KatuApp/app/(auth)/register.tsx: usa notifySuccess do NotificationProvider global após sucesso do serviço e navega ao login. O aviso persiste durante a navegação; rejeições continuam no formulário, sem sucesso falso. Não foi alterada a política de sessão existente.
- Katua_Web/frontend/src/App.jsx: passa a montar um único Toaster global.
- Katua_Web/frontend/src/layouts/AdminLayout.jsx: remove o Toaster local para evitar duplicidade.
- Katua_Web/frontend/src/pages/authentication/Login.jsx: aceita mensagens em error, preserva os erros por campo e também exibe aviso ao receber errors.
- KatuApp/server/tests/operational/run-local-validation.mjs: acrescenta cenários de navegador com formulários reais, API local real e banco isolado. Contextos do navegador são encerrados apenas no teardown para compatibilidade com Chromium portátil em modo single-process.

Verificações executadas:

- Painel: npm run build e ESLint dos três arquivos alterados passaram. Build mantém o aviso de tamanho de bundle já existente.
- App: ESLint de app/(auth)/register.tsx passou. Expo Web compilou e executou no Chromium.
- Validação integrada: 15 cenários passaram, incluindo os cenários anteriores de rotas/frotas e os dois novos grupos de notificações.
- Login sem credenciais exibe Informe email e senha.; login com credenciais inválidas recebe rejeição real da API, exibe E-mail ou senha inválidos., permanece no login e não cria token.
- Cadastro com e-mail existente exibe o erro retornado e não mostra sucesso. Cadastro de cooperativa válido mostra uma única confirmação na tela de login e a consulta SQL comprova a criação da cooperativa. Recarregar não repete o aviso.
- Resultado sanitizado: [resultados da validação](validacao-notificacoes-2026-10-19.json). Execução em Chromium, Expo Web, Fastify/Prisma e PostgreSQL WASM/PGlite locais. Tráfego do bundle direcionado à API local, sem acesso à VPS.

| Item | Prioridade | Estado | Pendência |
| --- | --- | --- | --- |
| Aviso do cadastro público no navegador | P1 | validado | Publicação pelo responsável |
| Aviso de falha no login público do painel | P1 | validado | Publicação pelo responsável |
| Entrega dos dois avisos na VPS | P1 | pendente de publicação | Atualização e conferência pelo responsável |
| Verificação visual do cadastro em Android/iOS | P2 | a confirmar | Dispositivo ou emulador não disponível nesta sessão |

Resumo de continuidade: decisões e arquivos acima; alterações restritas à apresentação das notificações e seus testes, sem mudanças na API ou no esquema do banco. Próximo passo: responsável publicar e conferir os dois fluxos no ambiente utilizado. Não houve deploy, alteração da VPS, migração, exclusão de dados ou observação em produção. As pendências anteriores de tipos, lockfile e concorrência nativa continuam registradas nas etapas anteriores.


## Correção complementar — acesso por link e recuperação (19/10/2026)

Autorizado pelo responsável: acrescentar a escolha de login Senha/Acesso rápido mantendo o desenho das telas, com envio de links por e-mail nos dois clientes. Implementação e limites estão em [acesso-por-email.md](acesso-por-email.md); contém arquivos, contrato, decisões, configurações e resumo de continuidade.

Validação final local: 24 verificações integradas passaram, com API real, SMTP local, banco PostgreSQL WASM/PGlite, painel e Expo Web. Inclui recuperação pelo formulário do painel, senha antiga preservada até a conclusão, login por link nos dois clientes, hash/expiração/uso único, audiência e perfil, conta inativa, falha e ausência de SMTP, duas tentativas simultâneas e HTTP 429. Os cenários anteriores de rotas, frota e offline também passaram. Mais 18 testes de contrato/SMTP ausente e 4 do painel aprovados. Builds e lint dos arquivos alterados passaram; checagem de tipos mantém apenas os diagnósticos anteriores.

| Item | Prioridade | Estado | Evidência / pendência |
| --- | --- | --- | --- |
| Login por link no painel e App Web | P1 | validado | Formulários e sessão na integração local; aguarda publicação |
| Recuperação muda senha só na conclusão | P1 | validado | Senha anterior funciona até redefinir; token não pode ser reutilizado |
| Duplicidade de avisos no layout de recuperação | P1 | validado | Removido Toaster de AuthenticationLayout; permanece o global |
| Tabela de tokens e configuração SMTP na VPS | P1 | pendente de publicação | Migração aditiva preparada; não executada na VPS |
| Entrega de e-mail real / provedor / domínio | P1 | a confirmar | Sem credenciais ou envio externo nesta sessão |
| Abrir link no aplicativo Android/iOS atualizado | P2 | a confirmar | Dispositivo/build nativo não disponível |
| Tela legada de configuração SMTP | P2 | confirmado | Aponta a /api/smtp-config; não configura o backend operacional |

Continuidade: arquivos e decisões no documento vinculado. Próximo passo é a publicação pelo responsável, com conferência do histórico de migrações e do ambiente antes de qualquer comando de banco. Não houve deploy nem alteração da VPS. O envio de e-mail de produção e a concorrência PostgreSQL nativa não foram validados.
