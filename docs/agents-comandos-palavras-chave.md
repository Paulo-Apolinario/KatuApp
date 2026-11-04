# Agentes — novos comandos e reconhecimento por palavras-chave

Implementação de 04/11/2026, somente backend e painel. Sem alteração no App da cooperativa, Android/iOS ou VPS.

O catálogo passa de sete para onze comandos. Os sete anteriores são preservados. Novos comandos:

| Chave | Agente | Consulta |
|---|---|---|
| TODAY_COLLECTIONS | Coletas | Coletas programadas para hoje e solicitações programadas ainda sem coleta vinculada |
| ROUTES_WITHOUT_RESOURCES | Rotas | Rotas ativas sem motorista ou veículo definido |
| PENDING_PROPOSALS | Gestor | Recomendações aguardando revisão humana |
| AUTOMATION_HEALTH | Gestor | Análises com falha nas últimas 24h e entregas de eventos pendentes, em processamento ou que precisam de revisão |

As consultas usam dados reais da cooperativa autenticada, contagens totais e listas limitadas. A programação de hoje usa o fuso do Ceará (UTC-3), data programada, exclui canceladas e não duplica solicitação já vinculada à coleta. Data desejada sozinha não confirma programação. Rotas sem vínculos são distintas de recursos indisponíveis: a análise de atenção existente continua verificando disponibilidade e conflitos. Recomendações pendentes não são automaticamente atuais; a revisão existente confere isso. Pendências da fila não significam necessariamente falha: podem aguardar intervalo, quota ou habilitação.

## Frases aceitas e esclarecimento

O reconhecimento é determinístico, sem IA generativa, API paga ou aprendizado automático. Preserva exemplos e aliases exatos e permite combinações de palavras conhecidas, acentos e variações de maiúsculas. Exemplos:

- “Por favor, me mostre as coletas pendentes”.
- “Preciso consultar as solicitações atrasadas”.
- “Gostaria de ver as coletas de hoje”.
- “Tem alguma rota sem motorista ou veículo?”.
- “Quero ver propostas aguardando revisão”.
- “Existe algum agente com erro de processamento?”.

“Quero ver as rotas” oferece opções para o gestor escolher. Não executa análise antes da escolha. Múltiplas intenções, como “coletas pendentes e atrasadas”, também pedem esclarecimento. As opções respeitam agentes habilitados, inclusive após alteração de configuração.

Ordens de alteração/cancelamento/aprovação, negação, texto desconhecido, números, pessoas, locais e períodos sem ferramenta implementada não são convertidos em consulta ampla. Por exemplo, “coletas de amanhã” ou “coletas de hoje do João” retornam orientação. Não há filtros inventados, inferência de pessoas ou execução de texto como código/SQL. Para ampliar o vocabulário, é preciso acrescentar regras/aliases e testes; o histórico não treina um modelo.

## Segurança e compatibilidade

Mesmo JWT, RBAC COOPERATIVE, pertencimento à cooperativa, quotas, idempotência, trava de concorrência e auditoria. Agentes desabilitados não executam comandos. Novas consultas não aprovam propostas, disparam retentativas, movem estoque ou alteram cadastros/rotas/coletas. Apenas a infraestrutura existente de análise registra execução e conversa. Não mudam frequências ou comandos padrão do worker.

APIs existentes preservadas: GET /agents e POST /agents/commands. A resposta não reconhecida inclui clarificationNeeded e suggestions quando aplicável. O painel mostra opções de esclarecimento e mantém o catálogo filtrado por agentes habilitados. Clientes antigos continuam usando os comandos anteriores.

## Validação

- 96 cenários backend aprovados, incluindo quatro comandos novos, frases, ambiguidade, filtros não suportados, RBAC, isolamento, data UTC-3, contagens, limites e idempotência.
- 28 cenários de automação aprovados em PostgreSQL nativo 16.13, incluindo dois processos concorrentes; zero pendentes.
- 31 cenários Chromium aprovados em desktop/tablet/celular, incluindo texto por palavras-chave, esclarecimento sem análise automática e escolha da consulta.
- TypeScript, build backend, Prisma validate, lint dos componentes alterados e build frontend aprovados. Persistem os avisos anteriores de tamanho de bundle; não houve otimização geral do painel.
- Evidência nativa: https://github.com/Paulo-Apolinario/KatuApp/actions/runs/41928452598
- Resultado estruturado: agents-comandos-palavras-chave-validacao.json.

Os 96 cenários foram repetidos localmente e no PostgreSQL nativo; o total distinto é 155 (96 + 28 + 31), não a soma de repetições. Testes usam bancos descartáveis. Não há nova migração; os modelos da entrega anterior permanecem necessários. Nenhuma operação foi executada na VPS. Para instalar, atualizar backend antes do painel, gerar Prisma Client, compilar e reiniciar a API pelo procedimento usual. Preservar configuração local de host e AGENTS_ENABLED.
