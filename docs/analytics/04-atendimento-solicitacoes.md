# Analytics de atendimento — 11/11/2026

Esta etapa acrescenta `GET /analytics/participation/attendance`, privado e somente de leitura, protegido pelo mesmo `reportScope` da primeira versão. Aceita exclusivamente `start` e `end`, com validação de datas, limite de 366 dias e horário de Fortaleza. Consultas agregam no PostgreSQL em transação Repeatable Read. Não há migração, dependência nova ou escrita nos fluxos operacionais.

## Três populações independentes

1. **Pedidos de coleta:** registros `Schedule` criados no período, por situação atual. Pendência significa REQUESTED/SCHEDULED/IN_PROGRESS sem recebimento confirmado da coleta vinculada. Agendamento futuro não é tratado como atraso.
2. **Ordens extras:** protocolos `ExtraCollectionOrder` criados no período. Pendências de análise são PENDING_REVIEW e NEEDS_INFO. Aceitação não equivale a recebimento. Recebimento pode ser confirmado pelo fluxo da ordem ou pela coleta vinculada, com data válida até a consulta.
3. **Chamados de PEV:** avisos `PevRequest` criados no período. OPEN/ASSIGNED são pendentes; RESOLVED/DISMISSED continuam distintos. Esses avisos não representam pessoas doadoras ou recebimentos individuais.

As populações **não são aditivas**. Uma ordem aceita pode aparecer também como pedido/coleta; cada quadro conta seu próprio tipo de registro, uma vez por ID. Contadores de vínculos explicam a interseção. Dois chamados sobre o mesmo ponto/coleta continuam sendo dois avisos, sem converter isso em duas doações. Não se publica um total geral de atendimentos somando os quadros.

## Datas, métricas e limites

- A seleção considera **criação no período**, com situação **atual até a consulta** (`CURRENT_STATE_BY_CREATION_DATE`). Não é fotografia histórica nem a fila completa de todos os tempos.
- Pendências são agrupadas por dias completos desde a criação: menos de 7, de 7 a 29 e 30 ou mais, até a data da consulta. O registro mais antigo segue a mesma população.
- Tempo mediano entre criação e recebimento usa somente pares válidos não negativos, em horas, com tamanho da amostra. Registros retrospectivos com recebimento anterior à criação são contabilizados separadamente; não são convertidos em duração zero.
- Recebimento posterior ao período mas anterior à consulta pode encerrar uma pendência criada no período.
- Falta de amostra resulta em `null`, não em tempo zero. PEV não recebe indicador de duração de recebimento.
- Datas de recebimento ausentes/futuras e vínculos incompatíveis com a cooperativa têm contadores próprios. Todos os joins de relações operacionais restringem a cooperativa; vínculos externos não trazem nomes, datas ou recebimentos da outra organização.
- Perfil, município e bairro pertencem à análise de participação. Este quadro é explicitamente de **toda a cooperativa**, filtrado apenas por período. Campos extras na query são rejeitados, evitando filtro ignorado silenciosamente.

Os conjuntos de vínculos de ordens são pré-agregados por solicitação antes do join para não multiplicar pedidos nem repetir busca correlacionada por protocolo. Não há consulta à base da VPS nos testes locais.

## Validação

Integração em `server/tests/participation/attendance.ts`, executada pelo runner existente com banco local descartável: situações, interseção entre fluxos, idade nos limites de 7/30 dias, agendamento futuro, mediana, exclusão retrospectiva, PEV, vínculo inconsistente, vazio, autenticação, escopo e query estrita. O runner emite fixture para o teste visual do painel. Também executar `npm run check` e `npm run build`.
