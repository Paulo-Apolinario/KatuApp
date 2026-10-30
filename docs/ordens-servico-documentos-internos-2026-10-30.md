# Ordens de Serviço e documentos internos - 30/10/2026

## Comportamento

Menu Coleta de Resíduo > Ordens de Serviço. Uma referência por coleta individual ou execução de rota (incluindo fixa), com todos os pontos. Busca por número da O.S., documento, código completo/curto de coleta, solicitação, gerador, rota ou equipe; filtros de emissão e situação atual. A aba Todos os documentos inclui saídas de lotes manuais sem inventar uma coleta de origem.

Os comprovantes são criados automaticamente nos eventos operacionais, dentro da mesma transação que grava o evento. Abrir a tela e baixar o PDF não emitem novos registros. O PDF é renderizado no navegador a partir do snapshot persistido, com número, O.S. vinculadas e identificação de documento interno. As telas do App não foram alteradas; eventos enviados pelos fluxos existentes passam a produzir os registros na API/banco.

## Emissão

- O.S. de programação: coleta pendente com catador, motorista e veículo; rota agendada com motorista, veículo, catador e pontos. Alterações da programação emitem versões adicionais, preservando anteriores. A referência da O.S. pode existir antes da liberação, sem PDF de programação emitido.
- Início em campo: registro de início, sem converter registros posteriores em autorizações retroativas.
- Coleta realizada: comprovante com quantidades por unidade, colaboradores e responsável registrado.
- Recebimento/conferência: comprovante de recebimento e novas versões quando a conferência muda.
- Encerramento/cancelamento: registro que preserva os atendimentos e ocorrências da execução, incluindo fechamento parcial.
- Encaminhamento: registro interno dos dados e situação da destinação, incluindo estoque, triagem e reserva. Intermediários não são descritos como comprovação de destino final.
- Destinação direta/descarte: também geram referência interna de saída/transporte.
- Saídas de estoque por venda, doação, envio direto ou descarte: comprovante interno com quantidade da saída, destinatário, lote, responsável e O.S. de origem. Reserva, liberação e processamento não são saídas físicas e não emitem esse comprovante.

Motorista e placa da saída são campos opcionais próprios. O veículo da coleta de origem não é usado para afirmar qual veículo transportou a saída. Documentos de transporte/ambiental externos permanecem referências opcionais, identificadas como informadas.

## Preservação e segurança

Modelos ServiceOrder, ServiceOrderCollection, InternalDocument e InternalDocumentLink. Referências históricas persistem se a coleta muda de rota. O documento de saída pode ser ligado a todas as O.S. históricas da origem. O modelo atual do lote possui uma coleta de origem; não foi introduzido um fluxo de fusão de lotes.

Snapshots operacionais usam projeções explícitas, sem dados de autenticação ou perfis socioeconômicos. As rotas exigem cooperativa ativa, isolamento por cooperativa e respostas privadas sem cache. O banco impede alteração e exclusão de documento emitido. Correções são novos registros; a visualização de um encaminhamento mostra sua situação atual separadamente do snapshot original.

Emissão transacional por gatilhos diferidos do PostgreSQL: inclui materiais e participantes gravados após a atualização da coleta na mesma transação. Chaves de evento evitam duplicação no reenvio. Operação desfeita por rollback não deixa documento órfão. A migração cria registros atuais de reconstrução para serviços antigos, sem inventar comprovantes emitidos no passado. Não são recriados documentos individuais históricos que nunca existiram.

Datas em PDFs e central usam America/Fortaleza. Litros, kg, toneladas, unidades e m³ são preservados sem soma entre grandezas distintas.

## API

GET /service-orders: lista paginada, busca, período, situação e referência da coleta.
GET /service-orders/:id: dados atuais, pontos e documentos preservados.
GET /internal-documents: lista paginada com filtros por tipo, lote, coleta e emissão.
GET /internal-documents/:id: snapshot persistido e referências das O.S.; situação atual do encaminhamento quando aplicável.

## Implantação

Aplicar 20261030030000_internal_service_documents após as migrações anteriores. Gerar Prisma, compilar e reiniciar katua-api.service antes de publicar o build do painel. A migração adiciona tabelas de documentos, vínculos, funções, sequências, gatilhos e dois campos opcionais de transporte em WasteStockMovement. Não altera quantidades ou status das operações existentes.

Não há emissão oficial, integração SINIR, MTR, CDF, nota fiscal, assinatura digital, geração de documento oficial ou upload de anexos nesta entrega. Um relatório interno de encaminhamento registra o que a cooperativa informou; não certifica recebimento externo nem regularidade ambiental.

## Validação

Foram exercitados rotas com vários pontos, coleta individual, coleta extra e seus fluxos existentes, óleo em litros, saída parcial, idempotência, cancelamento, destino direto, conferência, encerramento, mudança de rota, rollback, imutabilidade e isolamento entre cooperativas. Testes de navegador com API real local e banco descartável; três tipos de PDF baixados e renderizados para inspeção visual. Produção e dispositivos nativos não foram acessados. O aviso preexistente de tamanho de chunk do Vite permanece.
