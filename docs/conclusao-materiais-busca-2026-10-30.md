# Conclusão da coleta, acompanhamento dos materiais e busca — 30/10/2026

## Regra operacional

O encerramento da coleta e a situação dos materiais são independentes. A cooperativa pode concluir uma coleta recebida/conferida ou em triagem quando não há saldo sem encaminhamento. Continuam obrigatórios o registro de conferência, a divisão atualizada entre participantes quando houver equipe e o tratamento de ocorrências abertas. A conclusão é explícita pelo botão **Concluir coleta**, com confirmação; salvar um encaminhamento não encerra silenciosamente a coleta inteira.

| Encaminhamento | Situação do material | Após concluir a coleta |
| --- | --- | --- |
| Destinação direta | Etapa final registrada para a quantidade destinada | Registro preservado para consulta |
| Rejeito | Etapa final registrada como rejeito | Registro preservado para consulta |
| Descarte | Etapa final registrada como descarte | Registro preservado para consulta |
| Estoque | Continua no lote rastreável | Movimentação posterior feita na gestão de estoque |
| Triagem | Continua em acompanhamento | Pode converter o encaminhamento em reserva, estoque ou etapa final |
| Reserva | Continua em acompanhamento | Pode converter o encaminhamento em triagem, estoque ou etapa final |

Conversões de triagem/reserva depois da conclusão mantêm quantidades, data, responsável e histórico da coleta. Registram evento de auditoria da destinação e mantêm controle de versão e idempotência existentes. O cancelamento de encaminhamentos após concluir continua bloqueado, pois devolver saldo sem encaminhamento tornaria inconsistente a coleta encerrada. Destinações finais e transferências para estoque de coletas concluídas ficam preservadas; materiais em estoque continuam pela movimentação do lote.

Em entradas divididas entre diferentes encaminhamentos, a situação considera todos os registros ativos. Uma destinação final mais recente não pode ocultar uma parte ainda em triagem ou reserva. A interface separa saldo sem encaminhamento, quantidade em acompanhamento e quantidade em etapa final. Quantidades e unidades não são somadas entre materiais diferentes. Lotes em estoque são acompanhados pelo saldo e situação atuais; lote vendido/descartado deixa a fila de acompanhamento. A consulta de destinos finais não inclui transferência para estoque enquanto houver lote em acompanhamento.

A lista oferece **A concluir**, **Materiais em acompanhamento** e **Coletas concluídas**. A fila de destinação pendente continua mostrando triagem/reserva mesmo após concluir a coleta. O painel inicial também mantém essas pendências, em vez de ocultá-las quando a operação da coleta é encerrada. As descrições das seis opções de encaminhamento e os motivos de bloqueio da conclusão foram atualizados.

## Busca e rastreabilidade

Os códigos curtos já exibidos na interface são os oito últimos caracteres dos identificadores. A busca agora aceita esses códigos com ou sem `#`, em qualquer combinação de maiúsculas/minúsculas, e os identificadores completos. Aceita também a referência da solicitação vinculada à coleta e a O.C. vinculada quando aplicável.

As consultas de resíduos coletados, lista de coletas em campo, entradas e destinações aplicam as referências no servidor, antes da paginação e dentro do escopo da cooperativa. A lista de solicitações procura pelo próprio protocolo e pelo código da coleta vinculada. A lista de resíduos passa a exibir a referência da solicitação quando existir. Nenhum identificador existente foi alterado ou renumerado.

## Validação

- TypeScript da API e build do servidor aprovados.
- ESLint dos arquivos de produção alterados do painel sem erros/avisos e build Vite aprovado; permanece o aviso de tamanho do pacote principal existente.
- 32 grupos de testes de API com banco PGlite descartável: base operacional e dez grupos novos cobrindo os seis tipos, conclusão a partir de recebimento/triagem, divisão entre encaminhamentos, conversões após conclusão, auditoria, lote único, saldo parcial, falta de conferência, ocorrência aberta, acesso indevido, buscas em quatro listas e filtros de acompanhamento/finalização.
- Regressão da gestão de resíduos: 23 grupos aprovados. Os testes anteriores foram atualizados para a nova regra de permitir conclusão com triagem, preservando seu acompanhamento.
- Seis grupos de testes de navegador contra a API local real: conclusão com destino direto, buscas, solicitação vinculada, conversão após concluir, situação final preservada e tela de 390 px; sem erros JavaScript. Telas renderizadas inspecionadas.
- Dez verificações do painel: quantidades divididas, saldos de estoque, lote vendido, cancelamento, prontidão, permissão de edição e normalização do código.
- Nenhum teste acessa a VPS ou dados de produção.

Reprodução:

```bash
cd server
KATUA_VALIDATION_TOOLS=/caminho/ferramentas WASTE_COMPLETION=1 node tests/field-operations/run.mjs
KATUA_VALIDATION_TOOLS=/caminho/ferramentas KATUA_PANEL_FRONTEND=/caminho/painel/frontend WASTE_COMPLETION=1 WASTE_COMPLETION_UI=1 node tests/field-operations/run.mjs
```

No painel:

```bash
cd frontend
node tests/waste-completion/material-disposition.mjs
```

## Atualização na VPS

Não há migração de banco nem alteração das telas da Cooperativa no App. Atualizar primeiro a API e depois o painel.

API:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

Conferência após publicar: pesquisar uma coleta pelos códigos curto/completo e pelo protocolo da solicitação; verificar seu saldo; registrar o encaminhamento integral; abrir os detalhes, conferir a situação dos materiais e usar Concluir coleta. Para triagem/reserva, consultar Materiais em acompanhamento ou Destinações e usar Definir destino do material. Para estoque, seguir pelo lote correspondente. Registros já existentes passam a usar as regras e buscas novas sem edição direta no banco; nenhuma coleta será concluída automaticamente por esta atualização.
