# Detalhamento da cobertura dos recebimentos — 11/11/2026

Novos endpoints privados sob `/analytics/participation/coverage/:bucket` e `/analytics/participation/coverage/:bucket/:id`. Categorias permitidas: GENERATOR, PF, PEV, DELIVERER, UNATTRIBUTED e CONFLICT.

Lista e detalhe reutilizam exatamente o conjunto `geo_period` da cobertura: mesmo período de recebimento, seleção geográfica, status elegíveis e atribuição por origem. O filtro de perfil pertence aos indicadores de participação; a cobertura considera todos os perfis. A query continua validada pelo schema de participação, com busca literal e paginação no servidor.

Cada linha é uma coleta recebida, sem multiplicar por quantidade de materiais. A lista informa nome de origem/ponto, situação, data de recebimento, localidade do cadastro atual, identificador e quantidade de materiais discriminados. O detalhe mostra também as datas disponíveis, protocolo de O.C. vinculada e os materiais com suas unidades originais. Peso legado sem discriminação é apresentado como tal. Quantidade registrada não é alegada como reciclagem comprovada.

O detalhe é resolvido dentro da cooperativa, categoria e seleção antes da leitura dos materiais. URL de outra cooperativa, categoria incorreta ou ID fora do filtro retorna 404. Nomes de PEV/entregador e protocolos extras têm joins restritos à cooperativa. Relações conflitantes recebem título genérico e não expõem o nome de um gerador de outra organização. Origem textual não é convertida em identidade persistente.

Sem alteração de schema, migração ou escrita operacional. Integração com banco descartável valida reconciliação das seis categorias, filtros, busca literal, unidades em litros, entregador avulso, vazio, paginação independente do total, autorização e bloqueio de detalhes fora de escopo. `npm run check` e `npm run build` verificam a API.
