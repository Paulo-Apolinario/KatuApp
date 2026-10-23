# Gestão de resíduos — API e continuidade

19/10/2026. Base main 7825800. Autorização do usuário: aperfeiçoar todas as telas da Gestão de Resíduos. As alterações de API são necessárias aos contratos e à integridade usados pelo painel. Relatório completo e teste integrado: Katua_Web/docs/gestao-residuos-2026-10-19.md e frontend/tests/waste-workspace-browser.mjs.

## Alterações

- waste-stock.schemas.ts: campos opcionais de update de item/lote aceitam null/vazio para limpeza, mantendo omissão como preservação. Campos obrigatórios e criação mantêm validações existentes.
- waste-stock.service.ts: sincroniza unit/defaultUnit e status/isActive na criação/atualização/inativação do catálogo; novo lote manual inicializa availableQuantity; edição de quantidade manual sincroniza saldo apenas quando intacto ou no padrão legado. Quantidade/unidade/código/origem de lote vinculado à coleta são protegidos contra alteração; lote cancelado só pode ser consultado.
- collection-waste-destinations.schemas.ts: status ACTIVE/CANCELLED validado nas consultas gerais e por entrada.
- collection-waste-destinations.service.ts: aplica filtro status; usa trava transacional FOR UPDATE da entrada em create/update/cancel; não cancela nem muda tipo de destinação de lote vendido/descartado/cancelado ou com saldo movimentado. Remove interseção de tipo que contrariava stockItemId nullable do schema.

As respostas existentes e os endpoints foram preservados. Não altera schema.prisma, não exige migração, não acessa VPS, não altera .env ou dados reais. Não foi criado serviço externo ou emissão fiscal.

## Verificação

- tsc --noEmit e build tsup passaram.
- Painel: ESLint/build, 18 testes de contrato/regressão e nove cenários Chromium com API Fastify/Prisma/PGlite local passaram.
- Exercitados todos os tipos de destinação, catálogo e lote manual com persistência após recarga, geração de lote com origem, edição de campos nullable, cancelamento restaurando saldo e preservando histórico, lote vendido bloqueado e quantidade de lote vinculado protegida.
- Duas destinações simultâneas de 7 em saldo 10: uma criação, outra rejeição; saldo 3. Banco descartável PGlite, não PostgreSQL nativo.
- Outra cooperativa não leu/alterou IDs nem destinou entrada alheia; motorista teve criação de destinação negada. Demais combinações de perfis não foram exaustivamente testadas.

## Backlog

| Item | Prioridade | Estado |
| --- | --- | --- |
| Contratos e proteções entregues | P1 | validado localmente |
| Publicar API antes do painel | P1 | pendente de publicação pelo usuário |
| Concorrência PostgreSQL nativo e operação de lote paralela a cancelamento | P1 | a confirmar no ambiente adequado |
| Razão de vendas/saídas/ajustes e recebimento físico | P1/P2 | pendente de etapa de domínio; situação do lote não substitui registro financeiro ou conciliação física |
| Totais legados totalQuantity/totalQuantityKg | P2 | confirmado: não são disponibilidade definida; painel novo calcula por situação/unidade sem usá-los como saldo disponível |
| Paginação/agregação de catálogo e lotes no servidor | P2 | confirmado; consulta atual completa preservada |

## Continuidade

Publicar código da API, compilar e reiniciar katua-api.service; depois publicar/compilar painel. Sem migrate deploy/db push, sem exportação Expo e sem mudança de ambiente nesta etapa. Manter configuração local e interromper se git pull apresentar conflito. Testar com dados reais antes de marcar validado em produção. Preservar pendências anteriores, incluindo regularização do histórico de migrações e integridade de atribuições de coletas/rotas.
