# Identificação e busca de documentos operacionais

A consulta de documentos retorna contexto resumido dos dados preservados na emissão: material/quantidade/unidade, destinatário, data da operação, identificação dos lotes, origem e referência da rota quando presentes. O snapshot completo continua disponível apenas na consulta individual. Resumos de listas limitam a apresentação a seis materiais/lotes e quatro origens; o documento integral e o PDF preservam todos os registros.

A busca considera número/ID, material, destinatário, códigos/IDs dos lotes (inclusive os que aparecem apenas na alocação de uma saída consolidada), origem e referências de coleta/rota. A busca contextual aceita acentos e caixa diferentes e combina palavras. Caracteres de wildcard são tratados literalmente. Consultas SQL são parametrizadas e sempre limitadas à cooperativa autenticada. A paginação ocorre depois de determinar os documentos correspondentes, sem truncar resultados antes da contagem.

Filtros adicionais: `operation=STOCK_EXIT|DESTINATION|COLLECTION` e `serviceOrderId`. STOCK_EXIT inclui consolidados STOCK_DISPATCH e comprovantes de movimentação de lotes. O filtro por lotId também considera a alocação dos consolidados, cujo lotId principal pode estar vazio. Documentos sem O.S. permanecem acessíveis na central geral.

A listagem de O.S. mantém o documento SERVICE_ORDER da programação e agrega contagem por tipo e número de saídas de estoque. Para coletas extras sem gerador cadastrado, o título utiliza o nome da origem da O.C., sem trazer fotos/payload completo para a listagem.

Validação: TypeScript/build do backend e 40 casos de integração Fastify/Prisma em banco descartável com os gatilhos reais de documentos; incluem oito cenários específicos de contexto, busca, lotes consolidados, filtros/paginação, O.S., segurança/isolamento, caracteres especiais e documentos legados. Sem alterações no schema ou nos documentos históricos. Não é necessária migração.

Atualizar backend antes do painel: versões anteriores rejeitam os novos filtros. Preservar SHA/build anteriores para rollback; esta atualização faz apenas consultas e não reemite nem modifica documentos ou saldos. Não houve acesso à VPS.

## Destinação agrupada

O painel envia `grouped=1`: cada saída consolidada é um item de lista. Comprovantes individuais relacionados são identificados exclusivamente pelo `movementId` preservado em cada alocação do consolidado, sem inferências por material, destinatário ou horário. A exclusão visual dos filhos é feita antes da contagem/paginação; saídas sem consolidado continuam independentes. A busca pelo número de um comprovante individual encontra o consolidado correspondente. Filtros explícitos pelo tipo TRANSPORT_RECORD continuam permitindo a consulta individual; clientes sem grouped mantêm a resposta plana anterior.

`GET /internal-documents/:id/lots` retorna todas as alocações e as referências dos comprovantes individuais da cooperativa proprietária. Inclui código, quantidade retirada, saldos na emissão, unidade e origem preservada. A expansão não usa o limite de seis lotes do resumo. O endpoint é somente leitura e restrito à cooperativa autenticada.

Detalhes de O.S. aceitam `grouped=1`, mantendo os filhos dentro do consolidado quando o pai está vinculado à ordem. O campo `stockOperationCount` diferencia a contagem de saídas da contagem de documentos. Não há exclusão ou reemissão de evidências, movimentação de estoque ou migração.

Validação atual: 48 casos de integração, incluindo agrupamento exato, operações com atributos iguais, paginação, busca de filho, expansão completa (mais de seis lotes), contagens da O.S., compatibilidade e isolamento/autenticação.
