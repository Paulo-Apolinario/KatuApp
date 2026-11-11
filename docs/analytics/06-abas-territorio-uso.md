# Participação, território e uso — 11/11/2026

## Atendimento com soma verificável

O endpoint de atendimento inclui `reconciliation`, uma partição dos pedidos de coleta criados no período. A prioridade é: vínculo/data inválida → **a conferir**; recebimento válido → **recebido**; cancelado sem recebimento → **cancelado**; concluído sem recebimento → **encerrado sem confirmação**; aberto sem recebimento → **pendente**; demais casos → **a conferir**. Cada pedido pertence a exatamente uma categoria e a soma fecha o total. O vínculo com O.C. continua uma dimensão de interseção, incluída nesse total.

## Endpoints novos

- `GET /analytics/participation/generators`: geradores com recebimentos/solicitações no período e filtros geográficos/perfil, lista paginada, resumo integral e histórico pela rota existente. PF não entra nesse conjunto.
- `GET /analytics/participation/collectors`: catadores vinculados à cooperativa, participações em recebimentos, datas distintas e último recebimento. Quando existem participantes explícitos da equipe, o responsável legado não acrescenta outra participação. Total de coletas distintas e soma individual não são equivalentes. Não calcula renda, horas trabalhadas ou divisão presumida de peso.
- `GET /analytics/participation/territory`: recebimentos por bairro do cadastro atual, identificação, PEV e cobertura de coordenadas. Inclui origens não identificadas e registros sem localidade. Perfil não se aplica; período e geografia se aplicam. O mapa usa intensidade e posição média dos pontos com coordenadas válidas; não inventa polígonos oficiais ou residência de usuários de PEV.
- `GET /analytics/participation/usage`: período e paginação somente, com contas de vínculo organizacional atual, tempo ativo estimado, dias medidos e último sinal. Mesmas regras de autorização de cooperativa do Analytics.
- `POST /analytics/usage/heartbeat`: sessão autenticada, corpo estrito com `activeSeconds` inteiro entre 0 e 30 e `platform` WEB/APP. Usuário, cooperativa, data e intervalo são definidos no servidor, não pelo cliente.

## Instrumentação e armazenamento

`AnalyticsUsageDaily` armazena uma linha por usuário/dia. Um upsert atômico usa o maior valor no mesmo intervalo de 30 segundos do servidor, evitando multiplicação por abas concorrentes/reenvios. Dia usa America/Fortaleza; limite diário de 86.400 segundos. Plataforma é um indicador de cliente observado, não tempos separados somáveis.

O painel e o aplicativo atualizado medem tela em primeiro plano após interação nos últimos 60 segundos. Contagem é aproximada e conservadora; atrasos do timer são limitados. Segundo plano e inatividade pausam a medição. Falhas de rede não criam fila offline nem bloqueiam coleta. Não são enviados conteúdo de teclas, tela, endereço ou GPS de uso. A medição não prova jornada, produtividade ou trabalho realizado.

Tempo começa com esta atualização, sem reconstruir logins ou períodos anteriores. Clientes antigos, uso offline e intervalos não enviados não têm cobertura. PF não possui vínculo persistente de organização no schema; solicitar uma coleta a uma cooperativa não autoriza atribuir a ela todo o tempo global daquela pessoa. Assim, tempo PF não é atribuído no painel da cooperativa. Contas sem medição mostram ausência de dados, não uma inferência de desuso.

## Migração e validação

Migração incremental `20261111150000_analytics_usage_daily`, sem modificar dados de coleta. Aplicar com `npm run prisma:deploy`, sem reset ou db push, antes do reinício da API. A validação recria o schema anterior em PostgreSQL descartável, insere uma conta anterior, aplica a migração e verifica sua preservação.

Integração cobre reconciliação, geradores, atribuição em equipe, filtros/escopo, coordenadas ausentes, deduplicação concorrente de uso, limite de payload, conta sem vínculo e isolamento. Relógios dos clientes web e app são testados para inatividade/segundo plano. Também foram executados TypeScript/build da API, TypeScript do app e exportação Expo Web/PWA. Os números da VPS não foram auditados por essa validação local.
