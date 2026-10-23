# Correções do fluxo de coleta, recebimento, destinação e estoque — 22/10/2026

## Escopo e resultado

Implementação autorizada após a auditoria `auditoria-fluxo-coleta-estoque-2026-10-22.md`. Código da API e do aplicativo em KatuApp; painel em Katua_Web. A implantação na VPS continua a cargo do responsável pelo ambiente.

Uma coleta pode originar vários lotes por fracionamento. O saldo, as destinações e o histórico precisam explicar cada lote. Um lote cancelado permanece visível, com saldo disponível zero. O agrupamento no estoque é por material do catálogo e pode reunir várias coletas.

Exemplo validado: uma entrada de 50 kg admite dois lotes de 20 e 30 kg; uma terceira destinação que exceda esse saldo é rejeitada. Uma troca de ESTOQUE para destinação direta e novamente ESTOQUE preserva o lote anterior cancelado e registra o novo, sem somar o cancelado ao disponível.

## Backlog implementado

| Item | Entrega | Estado |
| --- | --- | --- |
| A01 | Ações de confirmar recebimento, iniciar triagem e concluir operação na Lista de Coletas; confirmação explícita, observações, proteção durante envio e erros retornados pela API | Concluído |
| A01 | Atualização da lista a cada 30 segundos enquanto a página estiver visível e sem diálogo aberto; atualização manual dos detalhes | Concluído |
| A01 | Telas antigas de cadastro/edição de resíduos redirecionadas para solicitação e acompanhamento do ciclo atual | Concluído |
| A02 | API rejeita STOCK antes de RECEIVED/SORTING e sem receivedAt; painel explica a necessidade de confirmar o recebimento | Concluído |
| A02 | Lote criado após recebimento recebe etapa ARMAZENADO; se a coleta já estiver em SORTING, recebe TRIADO. A etapa pode ser atualizada no lote | Concluído |
| A03 | Criação, alteração e cancelamento de destinações bloqueados quando a coleta está COMPLETED/CANCELLED; encerramento não reabre saldo silenciosamente | Concluído |
| A04 | Unidade do catálogo, da entrada e da destinação validada na criação e em qualquer edição para STOCK; reclassificação de lote movimentado bloqueada | Concluído |
| A04 | Unidade de catálogo já utilizado em solicitações, materiais coletados ou lotes preservada; lotes manuais também devem respeitar a unidade do catálogo | Concluído |
| A05 | Delegação exige veículo ACTIVE, valida motorista e compatibilidade; equipe herdada da rota revalidada; início revalida a equipe atual | Concluído |
| A06 | Início e conclusão de campo registrados primeiro em fila persistente, com identificador e projeção local; confirmação online e pendência offline distintas | Concluído |
| A06 | API reconhece reenvio da mesma operação e rejeita reutilização do identificador com dados diferentes; bloqueio transacional evita repetir a geração dos materiais | Concluído |
| A06 | Fila mantém ordem de início/conclusão por coleta, conserva falhas, recupera SYNCING interrompido e tenta novamente ao reconectar e periodicamente | Concluído |
| A06 | Navegador passa a persistir cache e fila; cache de rotas/coletas e operações ficam associados à conta; armazenamento indisponível gera erro explícito | Concluído |
| A06 | Nomes, quantidades e unidades dos materiais preservados na projeção offline; dados de outra conta não são exibidos nem enviados | Concluído |
| A07 | DELETE não transforma lote cancelado/vendido em descartado; lote finalizado não volta ao estoque via troca de status; baixa zera disponibilidade | Concluído |
| Complementar | Reserva é temporária: impede encerramento até ser convertida em destinação definitiva | Concluído |
| Complementar | Histórico de criação, alteração e cancelamento da destinação, com responsável, data e dados anteriores/posteriores, gravado na mesma transação | Concluído |
| Complementar | Lotes anteriores continuam identificados no histórico; consulta do estoque exibe vínculo à coleta e esclarece o saldo dos cancelados | Concluído |
| Complementar | Bloqueios compartilhados entre ciclo da coleta, destinações e movimentações de lotes vinculados | Concluído |
| Complementar | Catador permanece ON_ROUTE enquanto houver outra coleta em andamento; inativação não é revertida pela finalização/cancelamento; indicadores de dia/mês recalculados ao concluir campo | Concluído |
| Complementar | Totais antigos da API excluem lotes CANCELLED, SOLD e DISCARDED, mantendo a visão de estoque consistente | Concluído |

## Operação no painel

1. Solicitar e delegar a coleta, vinculando catador, rota, veículo e motorista quando aplicável.
2. Catador inicia e conclui a etapa de campo. Materiais geram entradas rastreáveis; essa etapa não cria estoque automaticamente.
3. Cooperativa abre **Coleta de Resíduo → Lista de Coletas → Ver detalhes**, confere materiais e registra **Confirmar recebimento** após a chegada física.
4. Registra **Iniciar triagem** e destina as entradas em Gestão de Resíduos. O botão de estoque exige recebimento; destinação direta externa continua possível sem passagem física pela sede e não cria lote.
5. Confere os saldos e reservas e executa **Concluir operação**. A API verifica o saldo real no servidor. Depois do encerramento, as destinações ficam preservadas para consulta.

Lotes vendidos ou descartados são movimentações de estoque posteriores. O encerramento da coleta não impede sua comercialização; impede alterar retroativamente as destinações que justificaram o encerramento.

## Integridade e histórico

As transições de coleta bloqueiam a linha da coleta antes de validar a etapa e escrever os materiais. Destinações bloqueiam primeiro a coleta e depois a entrada; movimentações do lote vinculado compartilham o bloqueio da coleta e do lote. Mudanças de unidade do catálogo e novas alocações ao catálogo também compartilham um bloqueio do item.

Os identificadores `startOperationId` e `fieldOperationId` e seus hashes são gravados junto à transição. Um reenvio autenticado do mesmo catador, com o mesmo identificador e os mesmos dados, retorna a coleta atual, inclusive se a cooperativa já avançou a etapa. Outro identificador não permite repetir a conclusão. A compatibilidade de clientes antigos sem identificador permanece, com conflito de etapa em repetição.

`CollectionWasteDestinationEvent` guarda criação, edição e cancelamento. A consulta da destinação apresenta os últimos 50 eventos, com estados anteriores/posteriores completos no registro. Não existem endpoints para editar/excluir esses eventos. O histórico começa nesta versão: eventos antigos não são inventados ou reconstruídos automaticamente.

## Sincronização e atualização de clientes

No aplicativo nativo, a fila continua no SQLite. No navegador, o adaptador dos repositórios grava em armazenamento local persistente. Limpar os dados do aplicativo/navegador elimina pendências locais: sincronize antes de fazê-lo.

A operação é gravada antes do envio. Sem resposta confirmada, permanece pendente. A conclusão não ultrapassa um início que falhou. Erros HTTP definitivos permanecem registrados para revisão; conflitos não são convertidos em sucesso. Reenviar uma etapa já pendente com outros materiais é bloqueado para evitar substituir dados silenciosamente.

Filas novas possuem identificação da conta e caches de rotas/coletas usam chaves por conta. Registros legados sem identificação de titular não são atribuídos automaticamente a quem fizer login. Antes de atualizar um dispositivo antigo, sincronize as pendências disponíveis e, após atualizar, abra a lista conectado para renovar o cache. Se houver registros legados sem titular ainda pendentes, preserve os dados locais e faça a conciliação técnica; não apague o armazenamento para resolver o problema.

## Migração e publicação na VPS

Migração nova: `server/prisma/migrations/20261022210000_collection_operation_replay/migration.sql`. Acrescenta quatro campos opcionais em Collection e a tabela de histórico. Não altera quantidades ou situações existentes.

Aplicar a migração **antes de reiniciar a API nova**. Atualizar API, painel e cliente em conjunto; apenas reiniciar a API não atualiza um aplicativo já instalado.

Cada comando abaixo é uma linha independente. Se o pull acusar alterações locais ou conflito, interrompa e preserve os arquivos de configuração e uploads.

```bash
cd /var/www/katua/app && git status --short && git pull --ff-only origin main
```

```bash
cd /var/www/katua/app/server && npm ci && npx prisma generate && npm run build && npx prisma migrate deploy && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

```bash
cd /var/www/katua/frontend && git status --short && git pull --ff-only origin main
```

```bash
cd /var/www/katua/frontend/frontend && npm ci && npm run build
```

A publicação do Expo Web deve usar o diretório configurado em `app.katua.com.br`; não presumir que seja o dist do painel. Dispositivos Android/iOS precisam receber uma versão atualizada pelo processo de distribuição do projeto. As credenciais e arquivos .env não fazem parte desta entrega.

## Validação

Resultados detalhados: `validacao-correcao-fluxo-2026-10-22.json`.

- API real Fastify/Prisma, migração nova aplicada em banco PGlite descartável e navegação Chromium para testar as ações reais do painel.
- Cenários de divisão 20+30, preservação de cancelados, limite de saldo, estoque antecipado bloqueado, destinação externa, unidade incompatível, encerramento protegido, manutenção, equipe herdada, disponibilidade do catador, reservas e reenvio identificado.
- Dez cenários executando os serviços e repositórios TypeScript reais com adaptador persistente web e transporte controlado: queda de rede, reinício, resposta perdida, sequência, projeção, troca de conta e armazenamento indisponível.
- Dois testes de contrato de sincronização existentes, incluindo falha parcial sem apagar pendências.
- Compilação da API, build do painel, exportação Expo Web, lint dos arquivos alterados e checagem de tipos do escopo alterado.

Não houve acesso ao banco da VPS. PGlite foi utilizado com uma conexão Prisma, portanto os resultados não são prova de concorrência real entre múltiplas sessões PostgreSQL. O código contém bloqueios transacionais; a validação de carga e concorrência em PostgreSQL do ambiente de homologação continua no backlog.

A checagem TypeScript geral do aplicativo já apresenta erros fora deste escopo, em telas de agendamento e fixtures antigas de teste. A checagem focada nos arquivos alterados passa, assim como a exportação Expo Web. O backlog abaixo registra essa limitação, sem declarar a checagem geral aprovada.

## Backlog de evolução e homologação

| Prioridade | Próximo trabalho | Critério de aceitação |
| --- | --- | --- |
| P1 operacional | Conferir os lotes da imagem no banco real, usando a consulta somente leitura da auditoria | Coleta/entrada/destinação de cada lote confirmadas e saldo reconciliado; nenhuma correção automática baseada apenas na imagem |
| P1 homologação | Testes em Android/iOS físico e PostgreSQL com múltiplas sessões | Concluir offline, reiniciar o aparelho, reconectar, repetir envios e disputar encerramento/destinação/venda sem duplicar entradas ou disponibilidade |
| P2 | Medição de recebimento por material e tratamento formal de divergências | Preservar quantidade informada em campo, registrar quantidade conferida e responsável e reconciliar previamente destinações externas; hoje divergências ficam nas observações e não alteram saldos automaticamente |
| P2 | Reabertura formal de coleta encerrada, com permissão específica, motivo e auditoria | Reabrir coleta e agendamento na mesma transação e liberar correções de destinação de maneira rastreável; nesta entrega, alterações de destinação encerrada são bloqueadas |
| P2 | Origens estruturadas de estoque manual e conciliação | Distinguir saldo inicial, doação, ajuste e material já originado de coleta |
| P2 | Aprovação das sugestões de material e governança do catálogo | Aprovar/associar sugestões sem criar estoque físico ou duplicar a entrada; usar o catálogo existente para destinar quando compatível |
| P2 | Tipagem geral do aplicativo e fixtures anteriores | `tsc --noEmit` geral aprovado, incluindo telas de agendamento e testes fora desta alteração |
| P3 | Indicadores e resumos das destinações mistas | Exibir todos os tipos alocados e seus quantitativos; evitar que um resumo pelo último tipo seja interpretado como única destinação |

Não foram modificados registros de produção nem removidos lotes antigos. Cadastros antigos com `unit` e `defaultUnit` divergentes precisam ser revisados: salvar novamente a unidade correta pelo cadastro sincroniza os dois campos; alterações de unidade com histórico incompatível exigem outro item de catálogo, sem conversão silenciosa de quantidades.
