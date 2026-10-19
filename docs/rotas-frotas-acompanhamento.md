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

## Validação operacional ainda necessária

Não foram utilizados PostgreSQL real, contas de operação, navegador autenticado, dispositivo móvel ou produção. A simulação de transação não comprova rollback/isolamento do PostgreSQL nem a ausência de conflitos reais entre processos.

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
| Contratos de edição de veículos/rotas | em implementação | P0 | Código e testes preparados; validação operacional real pendente. Publicação na VPS não realizada. |
| Testes de contrato desta etapa | validado | P0 | 8 testes backend e 2 web, com limites acima. |
| Estados COLLECTED/RECEIVED/SORTING no app e contadores | confirmado | P0 | Normalizador volta a PENDING; contadores incompletos. Próxima etapa. |
| Encerramento de rota e liberação dos recursos | a confirmar | P0 | Definir se marco é coleta/entrega/recebimento; separar transporte de destinação. |
| Exclusividade entre rotas, disponibilidade e vínculos encerrados | confirmado | P0 | Regras ainda incompletas; transação desta etapa não resolve dupla atribuição entre rotas. |
| Atribuições antigas | confirmado | P1 | Telas antigas ainda registradas. Uso real e funcionalidades a preservar: a confirmar. |
| Indicador totalColetado | confirmado | P1 | Valor artificial zero no app; depende de agregação real e período definido. |
| Seleção de rota/veículo atual | a confirmar | P1 | Revisão detalhada no app ainda necessária. |
| Manutenção, documentos e bloqueios | a confirmar | P1 | Confirmar contratos e definir situações de alerta/bloqueio com operação. |
| Offline, cache e permissões transversais | a confirmar | P0 | Isolamento e conflitos completos não cobertos por esta etapa. |
| Paradas estruturadas e roteirização | a confirmar | P2 | Separador corrigido; sequência, ruas, ETA e serviços externos ainda não implementados. |
| Falha prévia de tipos em destinação | confirmado | P1 | TS2345 com stockItemId nullable. Escopo diferente; apresentar correção antes de implementar. |
| Lockfile incompleto do painel | confirmado | P1 | npm ci falha antes de qualquer alteração. Avaliar reparo próprio e validar instalação reproduzível. |

## Continuidade

Primeiro concluir validação operacional da etapa 1 em desenvolvimento; não declarar funcionamento observado em produção. Em seguida alinhar os estados do ciclo da coleta, sem decidir silenciosamente o marco de encerramento do transporte. Nenhum deploy, migração ou exclusão de dados autorizado nesta entrega.
