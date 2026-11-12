# Acompanhamento da triagem e gráficos dos relatórios

Disponível no painel e no app web, dentro de Triagem e bags / Triagem e lotes → Acompanhamento da triagem. Esta fase não produz nem distribui APK.

## Leituras distintas

**Bags recebidas no período:** seleção por receivedAt em dias civis de Fortaleza. Mostra o saldo atual dessas bags, inclusive pesagens posteriores à data final escolhida. Recebido líquido = separado + rejeitos + saldo a triar. Rendimento = separado / líquido; rejeitos = rejeitos / líquido. Sem massa recebida, o percentual aparece sem base. Bag cancelada não compõe os totais.

**Produção realizada no período:** seleção pela data de lançamento do evento SORT. Inclui bags recebidas antes do período. Agrupa material e kg separados, rejeitos e quantidade de pesagens. Não somar produção com recebimento: são leituras diferentes das mesmas operações.

**Participante:** filtra eventos em que o catador foi registrado na equipe. Na seleção de bags, exige uma pesagem com essa participação dentro do período, além do recebimento dentro do período. Bags aguardando, ainda sem equipe, não pertencem a uma pessoa. O app web do catador inicia com a própria participação; é possível aplicar Toda a equipe. O painel e o app web da cooperativa iniciam com Toda a equipe.

**Histórico por pessoa:** kg em operações coletivas com participação. Uma pesagem com duas pessoas aparece em ambas as linhas, mas conta uma vez no total geral. Não somar essas linhas, não interpretar como rateio individual, pagamento ou produtividade individual. Responsável pelo lançamento e equipe executora continuam distintos. Os nomes do histórico são os gravados no momento da operação.

## Navegação

Filtros de hoje, 7 dias, 30 dias, mês atual, ano até hoje e intervalo personalizado de até 366 dias. Não aceita data final futura. Cartões de recebido, separado, rejeitos, pendente e concluídas abrem as bags correspondentes. Materiais abrem as pesagens em que apareceram. Detalhes possuem paginação de 20 registros e links de bag; no painel, também links dos lotes.

Pesos são sempre kg neste módulo. O saldo dos lotes após vendas não altera o histórico da produção da triagem. O rendimento não comprova reciclagem final nem substitui a metodologia de impacto ambiental.

## Gráficos

Painel, Relatórios da operação: concentração das quantidades por dia em mapa de calor, mantendo unidade selecionada; composição dos materiais em pizza. Dias sem movimento são preenchidos com zero em intervalos de até 366 dias, quando houver série datada. Registros sem data continuam separados, sem atribuição artificial a um dia. Datas civis não são convertidas a meia-noite UTC para evitar exibir o dia anterior.

Participação e atendimento: mapas de calor de recebimentos e participantes por intervalo, concentração por bairro, pizza de primeira participação versus recorrentes. No atendimento, uma pizza por canal; pedidos usam os grupos reconciliados recebidos/pendentes/cancelados/encerrados/a conferir. Ordens extras e PEVs usam suas situações. Não somar canais vinculados. Faixas de idade das pendências têm mapa de calor próprio e não representam SLA ou atraso.

Todas as pizzas mostram categorias mutuamente exclusivas dentro da leitura apresentada. Até oito fatias; quando necessário, as menores são agrupadas em Outros. A tabela associada mantém todos os valores. As cores são relativas à seleção atual e não servem para comparar intensidade absoluta entre filtros ou métricas diferentes. As tabelas e exportações existentes foram preservadas; esta fase altera as visualizações na tela.

## Acesso e limites

GET /mixed-bags/report reutiliza a autenticação e a cooperativa da sessão. Disponível para cooperativa e catadores ativos já autorizados a trabalhar nas bags. Não permite escolher outra cooperativa. O bloqueio de gestor do Analytics geral permanece como antes; este acompanhamento é operacional.

Sem alteração de schema nem nova migração nesta fase. A migração de bags da fase anterior continua necessária se ainda estiver pendente na VPS. O relatório não altera pesagens, lotes, totais ou participação. Consulta consistente via transação RepeatableRead. Acima de 5 mil bags recebidas ou 10 mil pesagens na seleção, solicita redução do período ou filtro de pessoa em vez de apresentar totais incompletos.

## Validação

Teste descartável de API em server/tests/mixed-bags/run.mjs: preservação dos fluxos anteriores, separação da produção e do recebimento, fronteira de meia-noite de Fortaleza, rendimento atual da bag, participação coletiva sem duplicar total geral, detalhes/páginas, ausência de dados, datas inválidas, permissões e isolamento entre cooperativas.

Teste frontend tests/reports/chart-data.test.mjs: datas civis, dias sem movimento, registros sem data e unidades incompatíveis. Conferência no navegador do painel e dos dois perfis do app web com respostas sintéticas emitidas pelo teste da API: filtros, cartões, materiais, histórico, recarga, erros/ausência de dados e gráficos. Builds e verificações TypeScript/ESLint dos arquivos alterados.

## Atualização acumulada (sem APK)

API e migrações pendentes, uma linha:

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
