# Estorno de pesagens, fechamento diário e alertas de bags

Disponível no painel e no app web. Não há compilação ou distribuição de APK nesta fase.

## Como usar

- Triagem e bags / Triagem e lotes → Fechamento e alertas: consultar bags paradas e conferir a produção diária.
- No detalhe da bag, o gestor pode expandir Corrigir pesagem confirmada, selecionar o lançamento, justificar e confirmar o estorno integral. Depois registra a pesagem correta.
- No fechamento, escolher o dia civil de Fortaleza e conferir materiais e totais. A observação do fechamento é opcional. A confirmação exige conferência dos totais que estão na tela.
- Para corrigir um dia fechado, reabrir com justificativa. O fechamento anterior continua no histórico. Após a correção, conferir e fechar novamente.

## Estorno e proteção do estoque

Somente COOPERATIVE pode estornar. COLLECTOR consulta o histórico e continua a triagem em dias abertos. Não existe exclusão do lançamento original: ele é marcado como estornado, preserva os quilos originais em MixedBagOutput e recebe um evento REVERSAL com referência ao original, justificativa, autor e antes/depois.

O estorno remove a quantidade válida do lote, zera a quantidade corrente do CollectionMaterial e da entrada operacional correspondente, cancela a destinação de entrada no estoque e cria movimento SORTING_REVERSAL. A quantidade original continua no histórico da bag, da destinação e do lote. Atualiza total corrente da coleta e do gerador, sem atribuir quilos individuais aos participantes. Devolve material e rejeitos ao saldo a triar da bag. Uma bag concluída e sua coleta são reabertas em triagem.

Lotes que possuem histórico de saída, descarte, reserva/liberação ou processamento não podem ser estornados automaticamente, mesmo se ainda houver saldo. Lotes sem saldo suficiente, reservados, processados ou indisponíveis também são bloqueados. O sistema não reescreve comprovantes de saída existentes. O gestor deve conferir o histórico e tratar a movimentação posterior antes de qualquer correção desse caso.

Quando o lançamento originou um lote posteriormente complementado por outras pesagens válidas, essas complementações precisam ser estornadas primeiro. Uma complementação pode ser estornada sem apagar a entrada inicial, desde que os demais requisitos sejam atendidos. Um lote reduzido a zero por estorno fica cancelado; a pesagem corrigida cria ou utiliza outro lote elegível.

O estorno é atômico: se uma das saídas do lançamento não puder ser revertida, nenhuma é alterada. Usa protocolo UUID, versão da bag, verificação de duplicidade e travas transacionais. Repetir uma confirmação já aplicada não gera segunda retirada. Após falha de rede, consultar o histórico antes de iniciar nova correção.

Relatório de triagem, composição atual dos lotes e composição de futuras destinações excluem entradas estornadas. Documentos e versões de conferências anteriores permanecem preservados. Participação continua coletiva, não é rateio de kg nem registro de pagamento.

## Fechamento diário

O fechamento abrange somente a produção da triagem: eventos SORT válidos pela data do lançamento, materiais separados, rejeitos, quantidade de bags e pesagens, participantes e referências aos eventos. Não fecha estoque, não soma recebimento com produção e não impede destinações, recebimento de novas bags ou conferência do peso de entrada.

Uma impressão digital do resumo impede confirmar valores que mudaram depois da conferência. O dia fechado bloqueia novas pesagens nesse dia. O estorno exige que estejam abertos tanto o dia do lançamento original quanto o dia em que será registrado o estorno. Datas são civis de America/Fortaleza e não aceitam dia futuro.

Somente gestor fecha e reabre. Reabertura exige justificativa de pelo menos cinco caracteres. Cada ação guarda autor, instante, versão e resumo anterior. A reabertura não apaga o fechamento anterior. A produção corrente pode mudar depois de reaberta; versões antigas não são recalculadas. Fechamento de dia sem produção é permitido e registra zero.

Há trava compartilhada por cooperativa/dia entre pesagens, estornos e fechamento, além das travas de bag e lotes. Isso evita fechar o dia enquanto outra sessão adiciona uma pesagem sem que a conferência perceba a mudança.

## Alertas de bags paradas

A lista mostra bags WAITING ou SORTING com saldo líquido ainda a triar e sem novo registro pelo intervalo escolhido. Opções de 24, 48, 72, 168 ou 720 horas. A idade usa o último evento da bag, incluindo recebimento, ajuste e estorno. Não é SLA nem indicador automático de atraso.

Consulta a própria cooperativa, com contagem e kg completos e detalhes paginados de 20 itens. Depois de uma nova movimentação ou conclusão, a bag deixa a seleção na próxima consulta. Não envia e-mails ou mensagens, nem depende de agente em segundo plano. Está disponível na área operacional, com atualização ao abrir/retomar a tela e botão de atualização.

## Banco e atualização acumulada

Nova migração: 20261113000000_triage_controls. Adiciona marcação/referência de estorno, tabelas de conferência diária e histórico, índices e relações. Não apaga pesagens nem converte registros anteriores. Aplicar junto às demais migrações pendentes; não editar migrations já aplicadas nem usar reset/db push.

API, uma linha:

```sh
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel, uma linha:

```sh
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

App web, uma linha:

```sh
cd /var/www/katua/app && git pull --ff-only origin main && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
```

## Validação

O teste descartável server/tests/mixed-bags/run.mjs aplica as migrações incrementalmente e preserva os testes anteriores. controls.integration.ts verifica estorno, bag concluída, rejeitos, complementações, bloqueio de lote já destinado, saldos e total do gerador, preservação do original, composição atual, permissões, isolamento, repetição de protocolo, resumo desatualizado, bloqueio de dia fechado, reabertura justificada, snapshot imutável e alertas atualizados após pesagem.

Verificações TypeScript e builds da API e app web; ESLint e build do painel. Conferência em navegador, com dados sintéticos e sem acesso à VPS, para gestor/catador: alertas, conferência, confirmação, fechamento e reabertura, estorno, bloqueio visível e preservação do histórico.

## Conferência após atualizar a VPS

1. Receber bag de teste, triar parcialmente e conferir bag/lote/gerador.
2. Estornar a pesagem antes de movimentar o lote; conferir saldo devolvido e histórico; registrar o peso correto.
3. Destinar parte de um lote e verificar que o estorno dessa entrada fica bloqueado.
4. Conferir e fechar o dia, tentar nova pesagem, reabrir com motivo e concluir a conferência novamente.
5. Consultar o intervalo desejado de bags paradas. Não é necessário alterar datas do banco para testar a interface; bags novas começam fora do alerta.
