# Auditoria do fluxo de coletas, rotas, destinações e estoque — 22/10/2026

## Resultado executivo

A imagem anexada mostra um lote disponível de 50 kg e um lote cancelado de 50 kg. O total disponível exibido é 50 kg. Isso é compatível com histórico válido de cancelamento/recriação ou mudança do tipo da destinação; não demonstra, isoladamente, duplicação do estoque disponível.

A reprodução em banco descartável confirmou dois caminhos que geram essa aparência: cancelar uma destinação STOCK e registrar outra; ou alterar uma destinação STOCK para DIRECT_DESTINATION e depois voltar para STOCK. Em ambos, o lote anterior permanece cancelado, com saldo disponível zero, e um novo lote recebe os mesmos 50 kg. Também foi reproduzida a divisão válida de uma entrada de 50 kg em dois lotes ativos de 20 e 30 kg.

A auditoria encontrou falhas reais independentes da aparência da imagem: edição de destinação com unidade incompatível; estoque disponível antes do recebimento físico; cancelamento de destinação reabrindo saldo de coleta já concluída; delegação aceitando veículo em manutenção; descarte permitindo alterar lote já cancelado; falta de ações de recebimento/triagem/conclusão nas telas atuais do painel; e ações novas do catador sem gravação na fila offline quando a rede falha.

Esta entrega é diagnóstico e backlog. Não contém correções nas regras de produção, migrações novas ou alterações de dados da VPS.

## Escopo e evidência

Foram examinados os serviços e schemas de agendamentos, coletas, rotas, PEVs, entradas, destinações, catálogo e estoque; as telas do painel de solicitações/coletas/rotas/resíduos/estoque; as ações do app do catador e seu serviço/sincronizador offline; e as ligações de motorista/veículo.

Base de código auditada: KatuApp/main `03689f078a6b41638e44cc94e04c8825773e36db`; Katua_Web/main `2b94edbce0eb26e1396b781883f427feaaedfd83`. A auditoria adiciona somente documentação e ferramentas de reprodução.

Foram executados 12 cenários de observação por API Fastify/Prisma real com banco PGlite descartável; um deles abriu o painel real em Chromium. Um teste adicional executou o serviço TypeScript real do app com transporte de rede simulado. Nos resultados, PASS significa que a observação esperada foi reproduzida: alguns cenários confirmam defeitos, e não representam aprovação do comportamento do sistema.

Não houve acesso ao banco da VPS nem teste de sensor/aparelho Android/iPhone. O banco de teste e seu proxy serializam operações; ele não substitui uma prova de concorrência em PostgreSQL com múltiplas sessões reais. Os riscos de concorrência listados abaixo permanecem análise estática.

Resultados e evidências: [validacao-auditoria-fluxo-2026-10-22.json](validacao-auditoria-fluxo-2026-10-22.json).

## Leitura correta da imagem

| Registro | Quantidade histórica | Situação | Saldo que deve entrar no disponível |
| --- | ---: | --- | ---: |
| LOT-20261022-155425-7VBAHG | 50 kg | Disponível | 50 kg, sujeito ao saldo efetivo do lote |
| LOT-20261022-121007-GUSASD | 50 kg | Cancelado | 0 kg |
| Total disponível mostrado | | | 50 kg |

Os códigos são os visíveis na imagem; os IDs e vínculos reais não foram consultados. A tela pagina materiais, por isso “1–1 de 1” pode coexistir com dois lotes expandidos de um material.

Uma coleta pode conter vários materiais; cada material gera sua entrada. Cada entrada pode ter várias destinações parciais. Cada destinação STOCK cria seu próprio lote. Portanto, quantidade de lotes não precisa ser igual a quantidade de coletas.

Exemplos confirmados:

- 50 kg coletados → STOCK 20 kg + STOCK 30 kg: dois lotes ativos, total de 50 kg.
- 100 kg coletados → STOCK 40 kg + destino direto 60 kg: um lote de 40 kg; a destinação externa não cria lote de estoque.
- STOCK 50 kg cancelado e STOCK 50 kg registrado novamente: dois registros de lote, somente um disponível.
- STOCK → destino direto → STOCK na edição: o lote anterior é anulado e um novo é criado; o vínculo atual da destinação aponta para o novo lote.

O sistema deve conservar o histórico. A melhoria necessária é explicar “lote cancelado/substituído”, mostrar o motivo e vincular claramente a operação que o substituiu. Apagar o lote cancelado perderia rastreabilidade.

## Fluxo completo: o que existe e o que falta

| Etapa | Comportamento atual | Avaliação |
| --- | --- | --- |
| Catálogo | Define material, classificação e unidade. O cadastro simples não deve representar entrada física. | Conceito correto. Unidade após uso precisa de maior proteção. |
| Solicitação | Agendamento registra gerador, previsão e materiais solicitados. | Previsão separada da coleta realizada. |
| Rota | Seleciona coletas existentes, motorista, veículo e ordem; valida recursos e vínculos em transação. | Proteções novas estão presentes. |
| Delegação | Cooperativa escolhe catador e pode informar rota/equipe; os vínculos da rota são herdados quando omitidos. Agendamento possui vínculo único de coleta. | Unidade de validação difere entre solicitação, rota e retirada de PEV. |
| Execução | Catador responsável inicia PENDING → IN_PROGRESS. Conclusão de campo gera COLLECTED. | Permissão por responsável e transições verificadas. |
| Medição em campo | Conclusão cria CollectionMaterial e uma CollectionWasteEntry por material, com saldo inicial integral. Não cria lote automaticamente. | Correto; repetição sequencial da conclusão foi rejeitada. |
| Chegada ao painel | API passa a devolver COLLECTED, responsável e materiais; lista/painel dependem de consulta/atualização. | Não existe push de recebimento em tempo real nessas telas. |
| Recebimento | API oferece COLLECTED → RECEIVED, com data e responsável. | Falta comando utilizável no fluxo atual de lista/detalhe do painel. |
| Triagem | API oferece RECEIVED → SORTING. | Falta ação correspondente na interface atual. |
| Destinação | Divide o saldo entre STOCK, TRIAGE, REJECT, DISPOSAL, DIRECT_DESTINATION e RESERVATION. | Consumo de saldo e unidade na criação são protegidos; edição/ciclo precisam de correções. |
| Formação do lote | Somente STOCK cria lote vinculado à entrada/material/coleta. | Correto para a origem; disponibilidade física é liberada cedo demais. |
| Visão do estoque | Interface soma disponíveis/reservados por unidade e exclui cancelados do disponível. | A imagem está coerente com esse cálculo. Totalizadores antigos da API têm outra semântica. |
| Encerramento da coleta | SORTING → COMPLETED exige entrada e ausência de saldo pendente. | Existe na API, mas precisa integrar a interface e os estornos posteriores. |
| Encerramento da rota | Pode ocorrer após finalização em campo, sem aguardar recebimento/triagem. | Distinção necessária e implementada. Rota concluída não significa estoque recebido. |

### Três significados de “triagem”

- `Collection.status = SORTING`: etapa operacional da coleta na cooperativa.
- `WasteDestination.type = TRIAGE`: destinação de uma quantidade para triagem, sem lote automático.
- `WasteStockLot.processingStage = TRIADO`: atributo do lote, cujo padrão do banco é TRIADO. Esse padrão não comprova que a triagem física ocorreu.

Esses conceitos precisam de rótulos e regras coerentes para evitar que um operador interprete o padrão do lote como confirmação de recebimento/triagem.

## Achados prioritários confirmados

### A01 — Falta fechar recebimento, triagem e conclusão na interface do painel — P1

A API e o serviço frontend possuem as operações receive/start-sorting/complete. A lista atual e seu modal apresentam situação, histórico e materiais, mas não oferecem os comandos de receber, iniciar triagem e concluir. O teste abriu o detalhe real e confirmou a ausência desses botões; a busca no código não encontrou uso dessas funções pelas telas de produção.

As telas antigas AddWaste/EditWaste continuam registradas por URL, usam o contrato antigo e não oferecem um fluxo completo para as novas etapas. Sua existência não resolve a falta de recebimento.

Correção proposta: fila “Aguardando recebimento”, detalhe com conferência, data/responsável, ações sequenciais e tratamento de divergência. Encaminhar os acessos antigos ao fluxo oficial. A conferência atual aceita só data/notas; pesagem recebida e diferenças devem ter registro próprio, sem editar a medição original.

### A02 — Estoque disponível antes do recebimento físico — P1

Foi gerado STOCK de 50 kg quando a coleta ainda estava COLLECTED e `receivedAt` era null. O lote retornou AVAILABLE com saldo de 50 kg. A criação da destinação verifica entrada/saldo/unidade, mas não exige que a coleta tenha sido recebida.

Impacto: a visão de estoque pode oferecer material ainda em transporte. O padrão TRIADO do lote aumenta a impressão de que houve processamento físico.

Correção proposta: definir o momento físico de liberação e validar na API. Sugestão: exigir recebimento para formar estoque disponível; distinguir material em trânsito/aguardando conferência e definir a etapa de processamento explicitamente. Destinação direta externa precisa de regra própria, pois pode não passar pela sede.

### A03 — Coleta concluída pode voltar a ter saldo pendente — P1

Reprodução: concluir a coleta com STOCK de 50 kg, cancelar essa destinação e consultar novamente. Resultado: coleta permaneceu COMPLETED; entrada ficou PENDING_DESTINATION com saldo de 50 kg. O cancelamento recalcula a entrada, mas não reconcilia o encerramento da coleta/agendamento.

Impacto: painel pode mostrar operação concluída enquanto há resíduo pendente de destinação. A volta entre estados não possui um procedimento oficial correspondente.

Correção proposta: bloquear alteração/estorno após encerramento, ou criar reabertura autorizada e auditada. Qualquer saldo reaberto precisa reconciliar os estados na mesma transação e respeitar o histórico.

### A04 — Edição de destinação aceita catálogo com unidade diferente — P1

Reprodução: destinação STOCK em KG, lote em KG; PATCH de `stockItemId` para um catálogo LITER. A API aceitou e manteve quantidade/unidade KG no lote sob um catálogo LITER.

A criação possui verificação de unidade; a edição verifica cooperativa e ativação, mas não repete a compatibilidade. O modal filtra opções por unidade, o que reduz a exposição na interface normal, mas não substitui a validação no servidor. Mudanças de catálogo e clientes diferentes continuam sujeitos à falha.

Correção proposta: centralizar a validação de unidade/cooperativa/ativação em criação, edição e mudança de tipo. Impedir alteração de unidade de catálogo já utilizado sem procedimento específico. Reclassificação de lote movimentado também precisa de regra e histórico.

### A05 — Delegação por solicitação permite veículo em manutenção — P1

POST /collections com um veículo MAINTENANCE retornou sucesso e criou a coleta. O serviço dessa delegação exclui apenas INACTIVE. O planejamento novo de rotas e a retirada de PEV exigem ACTIVE. A interface de solicitações filtra veículos ativos, mas a API continua permissiva e os recursos herdados da rota não são integralmente revalidados nesse caminho.

Correção proposta: usar a mesma validação de recursos nos três fluxos, inclusive herança e início da operação. Testar mudança de situação do veículo depois de montar a rota.

### A06 — Ações novas do catador não entram na fila offline — P1

O serviço real foi executado com transporte simulando falha de rede. `start` e `completeField` rejeitaram as duas chamadas; houve zero inclusão na fila e zero gravação em cache. Essas ações chamam `postCollectionAction`, que não utiliza o fallback existente em `updateStatus`.

O sincronizador ainda tem contrato legado de estados e operações; o app possui mensagens de operação salva offline, mas os métodos atuais não realizam esse salvamento nessas falhas.

Correção proposta: fila alinhada a start/complete-field e às unidades atuais, confirmação local honesta, ordenação de eventos, reconciliação após perda da resposta e idempotência por operação. Validar em Android/iPhone sem rede, ao recuperar conexão e com resposta perdida após gravação no servidor.

### A07 — Endpoint de descarte altera lote cancelado — P2

Depois de cancelar a destinação, DELETE /waste-stock/lots/:id alterou o lote de CANCELLED para DISCARDED. O PATCH normal bloqueia edição de lote cancelado, mas o descarte usa caminho diferente.

Impacto: um registro anulado pode passar a parecer descarte físico, distorcendo o histórico e indicadores de descarte. O teste não demonstrou duplicação de estoque disponível nesse caminho.

Correção proposta: regra comum de transições do lote, bloqueio de lotes anulados em todas as operações e movimento explícito com motivo/responsável para descartes reais.

## Regras empresariais que precisam de decisão

### Reserva não é destino final por definição automática

Destinar os 50 kg integralmente para RESERVATION consumiu todo o saldo da entrada e permitiu concluir a coleta após recebimento/triagem, sem lote de estoque. Esse comportamento foi reproduzido. Pode representar encerramento interno autorizado, mas não comprova destinação física definitiva. Definir se reserva é bloqueio temporário, reserva de estoque já recebido ou modalidade final de encerramento. Não corrigir apenas o nome do botão.

### Estoque manual

A entrada manual é deliberadamente independente de coleta. Pode ser necessária para saldo inicial, doação ou material externo, mas permite duplicidade operacional se um usuário lançar novamente material já originado por destinação. A interface orienta usar a destinação para material de coleta. Recomenda-se origem estruturada e justificativa, mantendo entrada manual separada e reconciliável.

### Material novo e catálogo

Material proposto em campo gera sugestão e conserva nome/unidade na entrada. É necessário deixar explícito quem classifica/aprova a sugestão, cria o catálogo e faz a associação. Não foi identificado um fluxo completo de aprovação de sugestões nas rotas/telas auditadas. Criar um catálogo não deve criar estoque automaticamente.

## Riscos adicionais identificados no código, sem reprodução concorrente em PostgreSQL real

- Início, conclusão de campo e transições da cooperativa leem estado e depois atualizam por ID, sem a mesma trava de entrada usada nas destinações. Duas confirmações simultâneas merecem teste com sessões reais. A repetição sequencial foi bloqueada, mas isso não prova proteção contra execução simultânea.
- Conclusão de campo cria materiais novos antes de atualizar a coleta. A unicidade de entrada por `collectionMaterialId` não impede, sozinha, dois conjuntos de materiais com IDs diferentes em uma corrida.
- Finalizar/cancelar uma coleta torna o catador AVAILABLE sem contar outras coletas em andamento; ele pode ter mais de uma operação vinculada. Contadores `kgMonth`/`collectionsToday` também são incrementos e precisam ser reconciliados por data real, não assumidos como agregação de calendário.
- Edição/descarte do lote e alteração/cancelamento da destinação não compartilham sempre a mesma trava. Validar disputa entre venda/descarte/reclassificação e estorno.
- `mapWasteStockItem` usa totalizadores legados que excluem apenas DISCARDED: `activeLotsCount`/`totalQuantity` podem incluir cancelados ou vendidos. O painel novo calcula o disponível pelos lotes e estados, por isso não apresentou 100 kg na imagem. Esses totais não devem ser usados como estoque disponível por clientes futuros.
- A situação resumida de uma entrada totalmente destinada considera o último tipo de destinação. Uma divisão mista deve ser comunicada pelas quantidades/histórico, sem dar a entender que tudo teve um destino único.
- Mudança de tipo preserva o lote cancelado e a origem, mas troca o vínculo atual `stockLotId`. Falta trilha de versões mais explícita da destinação e da substituição do lote, com motivo e autor da mudança.

## Salvaguardas verificadas

- Disponível do painel exclui lotes cancelados e mantém unidades separadas.
- Criação de destinação rejeita quantidade maior que saldo e unidade incompatível.
- Cancelamento de destinação restaura saldo e zera/anula o lote correspondente.
- Destinação de estoque vendido não foi cancelada automaticamente: HTTP 409.
- Quantidade de lote vinculado à coleta não pôde ser aumentada pelo PATCH: rejeitada.
- Outra cooperativa não pôde ler a entrada testada.
- Repetição sequencial da conclusão de campo foi rejeitada.
- Destinação externa não criou lote e divisão parcial conservou a quantidade total.
- Separação entre finalização em campo, recebimento e conclusão da rota está presente no modelo, ainda que a interface de recebimento esteja incompleta.

## Backlog recomendado e critérios de aceite

| Ordem | Correção | Aceite mínimo |
| --- | --- | --- |
| 1 | Recebimento/triagem/conclusão no painel + regra de disponibilidade física | Operador executa o ciclo inteiro sem chamadas manuais à API; material em transporte não aparece livre para saída. |
| 2 | Integridade após encerramento | Nenhuma coleta COMPLETED com saldo pendente sem reabertura autorizada e auditada. |
| 3 | Unidade e reclassificação | Nenhum lote/entrada/destinação sob catálogo incompatível; catálogo utilizado não muda de unidade silenciosamente. |
| 4 | Recursos comuns aos fluxos | Veículo em manutenção/inativo e motorista inativo bloqueados em rota, solicitação, PEV e início. |
| 5 | Offline e idempotência | Sem rede, evento confirmado localmente fica em fila; reconexão gera um único conjunto de materiais/entradas. |
| 6 | Transições do lote e histórico | Lote cancelado não vira descartado/vendido/disponível; substituição e estorno mostram motivo, autor e vínculos. |
| 7 | Concorrência com PostgreSQL real | Duas sessões concluindo/destinando/estornando não duplicam materiais nem ultrapassam o saldo. |
| 8 | Reserva, manual e conferência de recebimento | Regras documentadas, origens distintas, divergências registradas sem apagar a medição original. |
| 9 | Comunicação e atualização | Fila de chegada atualizada, horários de consulta claros, identificação de lote substituído e trilha única da coleta ao lote. |

## Conferência opcional dos dois lotes reais: somente leitura

A consulta abaixo deve ser executada apenas pelo responsável no banco correto. Ela não altera registros. Serve para confirmar origem, saldo e vínculo atual; a imagem sozinha não fornece os IDs necessários para provar qual operação ocorreu.

```sql
SELECT l.id, l."cooperativeId", l.code, l."lotCode", l.status AS "lotStatus",
       l.quantity, l."availableQuantity", l.unit,
       l."originCollectionWasteEntryId", e."collectionId",
       e."collectedQuantity", e."destinedQuantity", e."remainingQuantity",
       c.status AS "collectionStatus", d.id AS "currentDestinationId",
       d.type AS "currentDestinationType", d.status AS "destinationStatus",
       l.notes
FROM "WasteStockLot" l
LEFT JOIN "CollectionWasteEntry" e ON e.id = l."originCollectionWasteEntryId"
LEFT JOIN "Collection" c ON c.id = e."collectionId"
LEFT JOIN "CollectionWasteDestination" d ON d."stockLotId" = l.id
WHERE l.code IN ('LOT-20261022-155425-7VBAHG', 'LOT-20261022-121007-GUSASD')
   OR l."lotCode" IN ('LOT-20261022-155425-7VBAHG', 'LOT-20261022-121007-GUSASD')
ORDER BY l."createdAt";
```

Em mudança de tipo, o lote antigo pode não ter destinação apontando atualmente para ele; a origem da entrada e as notas continuam sendo evidências. Um disponível de 50 kg e um cancelado com saldo zero é compatível com o teste. Dois disponíveis somando mais que a entrada exigiriam investigação e correção específica dos dados.

## Arquivos centrais para as correções

- KatuApp: `server/src/modules/collections/collection.service.ts`, `collection.schemas.ts`, `modules/schedules`, `modules/routes`, `modules/bins/bins.service.ts`.
- KatuApp: `server/src/modules/collection-waste-destinations/collection-waste-destinations.service.ts`, `modules/waste-stock/waste-stock.service.ts`, `server/prisma/schema.prisma`.
- KatuApp: `src/services/collectionService.ts`, `src/offline/syncEngine.ts`, `app/(catador)/collect.tsx`.
- Katua_Web: `frontend/src/pages/waste-management/WasteList.jsx`, `CollectionRequests.jsx`, `frontend/src/components/waste-workspace/WasteOperations.jsx`, `WasteInventory.jsx`, `frontend/src/utils/wasteWorkspace.js`.
- Reprodução: `frontend/tests/flow-audit.mjs`, `server/tests/audit-flow/local-server.ts` e `server/tests/audit-flow/offline-probe.cjs`.
