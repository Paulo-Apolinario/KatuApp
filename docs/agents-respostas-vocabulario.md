# Agentes — respostas distintas, vocabulário e ChatBox

Atualização de 04/11/2026. Escopo: backend e painel administrativo. Nenhuma operação foi realizada na VPS; App da cooperativa e aplicativos nativos não foram modificados.

## Causa da apresentação repetida

As três consultas originais de Coletas compartilhavam o mesmo resumo e indicadores gerais. A lista já mudava parcialmente (atrasadas excluíam coletas operacionais), mas a apresentação tornava os comandos parecidos. Prioridades também incluía toda solicitação aguardando análise, mesmo recente e sem outro sinal. A consulta de atrasos filtrava as solicitações depois do limite de registros; isso podia omitir atrasos quando os primeiros registros tinham data programada futura.

## Escopos das respostas

| Comando | Resumo e indicadores |
|---|---|
| Pendências de coleta | Solicitações ativas, coletas pendentes em campo, ordens extras e relatos de PEV aguardando atendimento. São categorias diferentes, não um total de atendimentos únicos. |
| Solicitações atrasadas | Somente solicitações, ordens extras e relatos de PEV que ultrapassaram a referência configurada. Não apresenta o número geral de coletas em campo como se fossem solicitações atrasadas. |
| Prioridades de atendimento | Somente registros com sinais de revisão, separados por atenção alta/média, e possibilidades de agrupamento. Contagens explicitamente referentes ao recorte consultado. |
| Coletas de hoje | Mantém o escopo existente de programação do dia no fuso do Ceará, sem duplicar solicitação vinculada à coleta. |

Atenção alta usa atraso ou inconsistência de status. Atenção média usa ausência de vínculo operacional necessário ou informações incompletas. Solicitação recente apenas aguardando análise não se torna prioritária. Uma mesma solicitação pode estar pendente, atrasada e precisar de atenção; coincidência de registros não é eliminada artificialmente. Os motivos e critérios são apresentados.

O filtro de atrasos agora é aplicado no banco antes da paginação/limite, respeitando a precedência de data programada, data desejada e criação usada nas regras existentes. Contagens de ordens extras/PEVs atrasados também usam o filtro no total. O limite e o indicador de truncamento permanecem; priorização não promete ranking global fora do recorte.

Respostas antigas permanecem imutáveis no histórico. Para obter a apresentação nova, execute nova consulta após atualizar backend e painel.

## Arquivo de vocabulário

`server/src/modules/agents/agents.vocabulary.ts` contém:

- 77 frases revisadas, distribuídas entre os onze comandos existentes.
- Palavras de ligação e termos do domínio.
- Variações e abreviações: vc/vce/vcs/voces → voce; hj → hoje; pfv/pfvr → favor; correções pontuais como coelta/coeltas.
- Exemplos que devem pedir esclarecimento e exemplos não suportados que não podem executar consulta ampla.

A normalização remove acentos e diferenças entre maiúsculas/minúsculas. Assim, você, voce, Voce, VOCÊ e VC são tratadas de modo consistente quando integradas a um pedido reconhecido. A palavra isolada não basta para determinar uma consulta.

Frases como “Você pode mostrar as coletas pendentes?”, “Quais coletas precisam de atenção primeiro?” e “Você pode verificar se há falhas nos agentes?” usam ferramentas consultivas reais. “Quero ver as rotas” e “Me mostre as pendências” apresentam opções para esclarecer. Pessoas, locais, datas e filtros sem ferramenta implementada continuam recebendo orientação; não são silenciosamente ignorados. Pedidos de cancelamento, exclusão ou execução operacional não foram habilitados.

Para ampliar o vocabulário, editar o arquivo, verificar se a frase corresponde ao escopo real da consulta e acrescentar testes positivos, negativos e de ambiguidade. O teste de colisões impede frases/aliases normalizados apontando para consultas diferentes. Não há aprendizado automático com conversas, IA generativa, API paga ou modelo instalado.

## ChatBox

- Abertura sobreposta, sem diminuir/reorganizar a página.
- Barra fixa com Nova conversa, Comandos e Atualizar; Central de Agentes acessível.
- Conversas anteriores recolhidas, com seleção do histórico e paginação existentes.
- Comandos agrupados por agente habilitado; recolhimento após a primeira resposta e reabertura pelo botão Comandos.
- Respostas com título da consulta, agente responsável, data/hora e indicadores em cartões.
- Datas de referência e etiquetas de atenção alta/média nos registros, com motivos e acesso ao fluxo existente.
- Rolagem do conteúdo independente; acompanhamento das mensagens recentes sem rolar a página operacional.
- Enter envia; Shift+Enter quebra linha; Escape minimiza. Sem bloquear formulários operacionais.
- Mantidos histórico por usuário, contexto de avisos, idempotência, perda de sessão, indisponibilidade e permissões.

## Testes e compatibilidade

112 cenários backend aprovados, incluindo 77 frases com variações de escrita, ausência de colisões, filtros não suportados, quatro respostas de coletas distintas em cenário misto, prioridade sem falsos sinais e filtro de atraso antes do limite. Os exemplos múltiplos dentro de cada cenário não são contados como testes adicionais.

28 cenários de automação aprovados em PostgreSQL nativo 16.13, incluindo disputa entre dois processos. Os cenários de solicitação nova e isolamento foram atualizados para distinguir uma pendência normal de uma prioridade; a solicitação recebida continua presente na consulta de pendências.

31 cenários Chromium aprovados em desktop/tablet/celular, incluindo controles do novo layout, Enter/Shift+Enter, comandos por palavras-chave, esclarecimento, histórico, isolamento e sessão. Total distinto: **171 cenários aprovados**, sem falhas ou pendências. A rodada local teve o caso nativo de concorrência pendente; ele foi concluído no CI, sem ser contado duas vezes.

TypeScript, build backend, lint dos componentes modificados e build frontend aprovados. Prisma validado no CI. Evidência nativa: https://github.com/Paulo-Apolinario/KatuApp/actions/runs/41933037307 . Resultados em `agents-respostas-vocabulario-validacao.json`. Não há nova migração, nova dependência ou mudança no executor operacional (continua inexistente). Módulos, notificações, RBAC, quotas e isolamento existentes foram preservados.
