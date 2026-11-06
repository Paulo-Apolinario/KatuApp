# Identificação e busca de documentos operacionais

A consulta de documentos retorna contexto resumido dos dados preservados na emissão: material/quantidade/unidade, destinatário, data da operação, identificação dos lotes, origem e referência da rota quando presentes. O snapshot completo continua disponível apenas na consulta individual. Resumos de listas limitam a apresentação a seis materiais/lotes e quatro origens; o documento integral e o PDF preservam todos os registros.

A busca considera número/ID, material, destinatário, códigos/IDs dos lotes (inclusive os que aparecem apenas na alocação de uma saída consolidada), origem e referências de coleta/rota. A busca contextual aceita acentos e caixa diferentes e combina palavras. Caracteres de wildcard são tratados literalmente. Consultas SQL são parametrizadas e sempre limitadas à cooperativa autenticada. A paginação ocorre depois de determinar os documentos correspondentes, sem truncar resultados antes da contagem.

Filtros adicionais: `operation=STOCK_EXIT|DESTINATION|COLLECTION` e `serviceOrderId`. STOCK_EXIT inclui consolidados STOCK_DISPATCH e comprovantes de movimentação de lotes. O filtro por lotId também considera a alocação dos consolidados, cujo lotId principal pode estar vazio. Documentos sem O.S. permanecem acessíveis na central geral.

A listagem de O.S. mantém o documento SERVICE_ORDER da programação e agrega contagem por tipo e número de saídas de estoque. Para coletas extras sem gerador cadastrado, o título utiliza o nome da origem da O.C., sem trazer fotos/payload completo para a listagem.

Validação: TypeScript/build do backend e 40 casos de integração Fastify/Prisma em banco descartável com os gatilhos reais de documentos; incluem oito cenários específicos de contexto, busca, lotes consolidados, filtros/paginação, O.S., segurança/isolamento, caracteres especiais e documentos legados. Sem alterações no schema ou nos documentos históricos. Não é necessária migração.

Atualizar backend antes do painel: versões anteriores rejeitam os novos filtros. Preservar SHA/build anteriores para rollback; esta atualização faz apenas consultas e não reemite nem modifica documentos ou saldos. Não houve acesso à VPS.
