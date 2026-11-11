# Analytics acionável — 11/11/2026

Entrega somente de leitura nos dados operacionais, sem nova migração. Usa a tabela de uso criada na etapa anterior.

## Pedidos e qualidade

`GET /analytics/participation/requests/:outcome` aceita ALL/RECEIVED/PENDING/CANCELLED/CLOSED_WITHOUT_RECEIPT/CHECK. Período por criação, toda a cooperativa, busca literal e paginação. A classificação é compartilhada com a reconciliação do resumo, evitando regras diferentes entre número e lista. Cada registro informa a solicitação e a coleta vinculada quando disponível. A abertura/correção continua na operação existente.

`GET /analytics/participation/quality/:issue` usa as mesmas condições dos diagnósticos do overview: datas ausentes/futuras e vínculos conflitantes em todo o histórico; quantidades, peso legado, bairro e origem em recebimentos do período/geografia; solicitações sem origem ou situação divergente criadas no período em toda a cooperativa. Os diagnósticos podem se sobrepor. Não são somados nem usados como nota individual de qualidade. Busca não altera os totais do resumo.

## Comparação

`GET /analytics/participation/comparison` retorna participantes identificados, participações, recebimentos, repetição e pedidos criados. Os primeiros indicadores usam recebimento; os pedidos usam criação em toda a cooperativa, sem geografia/perfil. O intervalo anterior tem o mesmo número de dias civis e, quando o dia atual está parcial, termina no horário equivalente. A leitura mantém a situação/cadastros atuais dos registros nos dois intervalos, incluindo correções retroativas conhecidas na consulta.

Percentual usa `(atual-anterior)/anterior*100`; base zero retorna `null`. Diferença absoluta é informada. A consulta não prova completude histórica, tendência estatística ou efeito causal. Recebimentos sem data/futuros e vínculos a conferir do histórico são exibidos como limites da interpretação.

## Geradores e materiais por bairro

Geradores incluem primeira participação registrada, retorno e repetição no período, sem inferir abandono. O detalhe inclui materiais agregados pelos recebimentos selecionados, com unidade preservada. Quantidade registrada pode aguardar conferência.

`GET /analytics/participation/territory` admite `materialKey`, além dos filtros existentes. Opções distinguem ID de catálogo/nome informado e unidade. A seleção agrega quantidades por coleta antes de agrupar bairros: dois itens do mesmo material não duplicam o recebimento. Mapa representa número de recebimentos com aquele material; tabela informa quantidade na unidade original. Nenhuma conversão de litros em massa. Fonte de localidade e coordenadas permanece cadastro atual; o mapa não cria polígonos oficiais ou residência de usuários de PEV.

## Uso e relatório executivo

Cobertura de uso informa contas vinculadas/com sinal, clientes observados por conta, cobertura por perfil e primeiro dia com sinal disponível para membros atuais. Não interpreta ausência de sinal como versão antiga, instalação ausente ou desuso. Uma conta pode ter sinal web e app.

`GET /analytics/participation/executive` produz resumo agregado em **uma transação Repeatable Read**, com os totais completos, comparação, reconciliação de pedidos, qualidade do período, bairros, quantidades por unidade e cobertura de uso. Exportação não depende da página, busca por pessoa ou material local do mapa; esses limites são escritos no arquivo. Não exporta lista de usuários/CPFs/telefones. A identidade da cooperativa deriva da sessão. Todos os endpoints mantêm autorização por cooperativa e respostas privadas/no-store.

## Validação

Testes em PostgreSQL descartável conferem todas as listas contra os contadores, isolamento/queries estritas, horário parcial equivalente, base zero, classificação de pedidos, materiais em litros e agregação sem duplicar coleta, resumo independente de paginação e escopo da exportação. Foram executados check/build da API. Nenhuma auditoria ou alteração de registros da VPS foi realizada por essa validação local.
