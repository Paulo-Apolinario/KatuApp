# Rascunhos, endereço manual e saída consolidada de estoque

## Comportamento

- O App oferece exclusão confirmada apenas de rascunhos locais ainda não enviados. A conta proprietária e a fila são conferidas novamente antes da exclusão. Um registro mínimo de exclusão impede que salvamentos atrasados restaurem o conteúdo; não inclui endereço, fotos ou materiais.
- Escritas de rascunho, exclusão e envio são serializadas por conta/protocolo. No navegador, Web Locks também coordena abas. Um autosave não pode substituir uma ordem já enviada.
- Endereço manual fica visível antes da ajuda de CEP. CEP e coordenadas são opcionais. Editar o endereço cancela a busca pendente e impede que uma resposta antiga o sobrescreva. Nome e endereço da retirada continuam necessários.
- Observações são opcionais ao aceitar ou receber uma O.C. A confirmação do gestor continua obrigatória. Recusa e pedido de complementação exigem explicação; regras de guarda e justificativas de divergência de quantidade continuam vigentes.

## Destinação por quantidade

No painel, em **Estoque e Lotes → Estoque atual → Destinar quantidade**, o gestor informa material, unidade, quantidade, destinatário e data/hora. O sistema apresenta a distribuição FIFO (recebimento mais antigo, desempate por ID) antes da confirmação explícita.

Somente lotes disponíveis da mesma cooperativa, material e unidade participam. Reservas não são liberadas automaticamente e não há conversão entre unidades. Limite de 500 lotes por saída. O saldo parcial permanece no estoque; a quantidade original do lote é preservada.

A confirmação bloqueia o protocolo, o material, as coletas de origem e os lotes em ordem estável. A prévia é recalculada sob bloqueio: versões/saldos alterados exigem nova conferência. Movimentos individuais e documento consolidado são criados na mesma transação. Falha na emissão desfaz a baixa. O mesmo protocolo com os mesmos dados retorna a operação anterior; dados diferentes são recusados.

Documento `STOCK_DISPATCH`: material/unidade/total, lotes, quantidade anterior/retirada/restante, origem, IDs de movimentos, destinatário, data/hora da saída e do registro, responsável e dados opcionais de transporte. Vincula O.S. de origem existentes. Documentos individuais de transporte emitidos pelos gatilhos atuais permanecem preservados. É evidência interna, sem valor de documento fiscal/ambiental oficial.

Resposta de rede incerta mantém o protocolo e payload na sessão do navegador. O gestor consulta o resultado; se ainda não localizado, repete **o mesmo protocolo**, protegido por idempotência, antes de qualquer nova operação. Não apague a sessão enquanto houver confirmação pendente.

## Validação

- TypeScript do App/backend, build do backend, exportação Web/PWA e validação Prisma.
- 30 casos de integração Fastify/Prisma em banco descartável, incluindo gatilhos de documentos existentes, isolamento, autenticação, FIFO, reserva, unidade, precisão decimal, concorrência de protocolos, prévia obsoleta, rollback e observações opcionais.
- 10 verificações de armazenamento/fila offline; exclusão, troca de conta, tombstone, pendência de envio e falha de armazenamento.
- 15 casos de navegador do App Web, incluindo exclusão confirmada, endereço sem CEP e cancelamento de resposta CEP atrasada.
- CI `stock-dispatch-validation.yml`: PostgreSQL 16 descartável com quatro conexões para validar contenção real, sem credenciais ou acesso de produção.

Execução local: `KATUA_STOCK_DOCUMENT_TRIGGERS=1 KATUA_VALIDATION_TOOLS=/caminho/ferramentas node server/tests/collector-web/run.mjs`. Sem `KATUA_NATIVE_POSTGRES_BIN`, usa PGlite com uma conexão; essa execução não substitui a cobertura de concorrência nativa da CI.

## Atualização posterior

Nenhuma nova migração: reutiliza `WasteStockMovement`, `InternalDocument` e vínculos existentes. Atualizar backend, App Web/PWA e painel. Não é necessário reconstruir o App nativo para atualizar o App Web. Em aparelhos nativos, a mudança depende da distribuição do novo pacote.

Antes do deploy manual, registrar os SHAs atuais, manter cópia dos builds e backup verificado do banco pelo procedimento habitual. Rollback de código não desfaz saídas de estoque já confirmadas; não restaurar um backup antigo sobre operações novas. Corrigir operações reais por procedimento auditável, preservando os documentos. Nenhum dado ou serviço da VPS é alterado por este trabalho.
