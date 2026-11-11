# Analytics de participação — primeira versão funcional

Implementação em 11/11/2026. O levantamento em `01-levantamento-e-dicionario.md` documenta a etapa anterior. Esta entrega cria os quatro endpoints sob `/analytics/participation`: `context`, `overview`, `participants` e `participants/:kind/:id`.

Todos exigem sessão de cooperativa ativa, reutilizam `reportScope` e não aceitam escolha de cooperativa pela query. Respostas são privadas e `no-store`. Consultas são agregadas no PostgreSQL; detalhes e listas são paginados. Não há alteração de schema, migração, dependência nova, worker ou escrita em dados operacionais.

## Regras implementadas

- Cada `Collection.id` conta uma vez, independentemente dos materiais/documentos. Participação confirmada requer estado RECEIVED, SORTING ou COMPLETED e data de recebimento válida.
- População principal: geradores vinculados e pessoas físicas identificadas pela solicitação. Autores catadores/gestores não viram doadores. PEVs, entregadores avulsos e origens sem identidade suficiente ficam na cobertura separada.
- Vínculos conflitantes, inclusive entre cooperativas, ficam fora dos participantes identificados.
- Ativos = primeira participação registrada + participantes com histórico anterior. Primeiro recebimento considera o histórico da cooperativa, além da janela e dos filtros geográficos.
- Janelas de 7/30/60 dias incluem o dia de referência; intervalo mediano e desvio padrão exigem três datas distintas. Múltiplas operações no mesmo dia não aumentam essa amostra.
- Períodos usam dias civis em America/Fortaleza e fim exclusivo. Campos Prisma `timestamp` são convertidos de UTC antes do agrupamento. O dia atual é parcial. Período máximo: 366 dias inclusivos.
- Solicitações em aberto foram criadas no período e continuam em situação aberta, sem recebimento confirmado até a consulta, inclusive quando o recebimento ocorreu depois do período histórico.
- Qualidade informa numerador, base e alcance: histórico operacional, recebimentos históricos, recebimentos geográficos do período ou solicitações criadas no período.

`CURRENT_STATE_BY_EVENT_DATE` é uma visão atual dos registros pelas datas dos eventos. Não reconstrói estados históricos nem o instante em que o sistema soube de uma informação. Localidade é a do cadastro atual; não constitui residência ou cobertura territorial comprovada.

## Validação

`npm run check` e `npm run build`. A integração em `server/tests/participation` cria exclusivamente banco PostgreSQL descartável via PGlite e testa atribuição, datas locais, filtros, histórico, agregação independente de paginação, regularidade, autorização e isolamento entre cooperativas. O executor exige ferramentas externas PGlite/PGlite Socket apontadas por `KATUA_VALIDATION_TOOLS`; nunca usa banco da VPS. Pode emitir uma fixture sintética para o teste visual através de `KATUA_ANALYTICS_FIXTURE`.

## Alcance desta etapa

A primeira entrega é descritiva. Interação digital, diversidade completa de modalidades, disponibilidade histórica de serviço e previsão de comportamento exigem instrumentação/validação próprias. Não há pontuação de engajamento, comunicação automática, exportação de dados pessoais ou conversão presumida de litros em massa. Cobertura e desempenho com volumes de produção ainda dependem de observação após implantação.
