# Vendas e preparação de nota

## Fluxo da cooperativa

Gestão de Resíduos → Vendas → Registrar venda → buscar material → informar comprador, quantidade e data → conferir os lotes da prévia → confirmar a saída.

O registro usa o fluxo existente de saída por quantidade e baixa os lotes uma única vez, com controle de saldo, versão e protocolo. A venda aparece em Vendas automaticamente. Também aparecem as vendas por lote já existentes. Uma saída consolidada aparece uma única vez, com todos os lotes no detalhe. Doação, descarte, destinação direta e simulação não compõem essa lista de vendas.

Depois da saída: Vendas → Preparar nota → informar preço unitário e observações → Salvar valores da nota. Não é obrigatório preço de referência no catálogo. Não há nova baixa de estoque ao salvar preços ou baixar PDF. Quantidade e unidade vêm da saída. Cada saída do fluxo atual tem um material/unidade; múltiplos lotes desse material são consolidados.

A preparação registra valores comerciais, não autorização de NF-e. Preços usam até quatro casas, total usa Decimal e duas casas. Revisões ficam no histórico. O PDF usa os dados salvos na preparação e informa RASCUNHO - SEM VALIDADE FISCAL. Campos tributários a conferir/não calculados não representam isenção. Não há recebimento financeiro, pagamento ou tributação automática neste módulo inicial. Não editar os valores de simulação como se fossem vendas reais.

## API e isolamento

GET /sales: q, status PENDING/PREPARED, dateFrom/dateTo (data de saída em Fortaleza), page, limit até 50.
GET /sales/:key: saída, lotes, preparação e últimas 20 revisões.
PUT /sales/:key/note: operationId UUID, expectedVersion (zero na primeira preparação), unitPrice e notes.

Somente cooperativa ativa acessa os próprios registros. ADMIN usa o ambiente de simulação, não este endpoint operacional. Todas as consultas usam cooperativeId da sessão. Uma revisão é imutável; conflito de versão exige atualizar e conferir. Reenvio com mesmo corpo/ator/UUID retorna o registro sem criar outra revisão. Outra carga com mesmo protocolo é rejeitada. SQL parametrizado; nunca interpretar pesquisa como SQL.

Migração 20261124010000_sale_note_preparation cria SaleNotePreparation e SaleNoteRevision, sem converter estoque ou regravar movimentações anteriores. Nenhuma chamada SEFAZ/SINIR.

## Interface e documentos de teste

As seis seções de resíduos usam navegação, títulos e hierarquia visual comuns. Etapas de coletas ficam num seletor; ajuda, opções de catálogo, composição técnica e período são expansíveis. Triagem e bags mantém recebimento, pesagens, acompanhamento e controles.

A simulação agora começa com materiais e quantidades, sem preço obrigatório no rascunho. PREPARE_NOTE define os preços antes da NF-e simulada. Valores não podem mudar depois de confirmação/resultado pendente de NF-e ou saída. Vendas antigas da simulação com preços continuam válidas. PDF de NF-e de teste segue a estrutura visual DANFE de referência: recebimento, emitente, destinatário, fatura, impostos, transporte, produtos e informações adicionais. Chave/protocolo são explicitamente inexistentes; avisos de documento não válido aparecem em todas as páginas. MTR/CDF continuam demonstrativos próprios.

## Validação

Na pasta server, com dependências de validação locais:
KATUA_VALIDATION_TOOLS=/caminho/node_modules node tests/sales/run.mjs
KATUA_VALIDATION_TOOLS=/caminho/node_modules KATUA_SALES_BROWSER=/caminho/Katua_Web/tests/sales/browser.mjs node tests/sales/run.mjs

Testes usam PostgreSQL descartável PGlite, API Fastify/Prisma real e Chromium local. Verificam migração, venda consolidada versus individual, total e preço decimal, histórico, reenvio, conflito, isolamento, datas, preparação sem baixa, PDF e navegação desktop/móvel. Também executar tests/simulation/run.mjs e o acompanhante browser para validar o novo momento de precificação e a preservação dos dados operacionais.
