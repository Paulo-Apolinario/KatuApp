# Rotas vencidas e execuções com pendências — 29/10/2026

## Comportamento entregue

- A data vencida é um aviso calculado no fuso do Ceará, sem cancelamento automático. Aparece na lista de rotas, na lista agrupada de rotas fixas e no tratamento da execução.
- No App do catador/motorista, “Visita não realizada” registra ponto, motivo, responsável e data, sem cancelar o atendimento ou criar peso/estoque. Os pontos relatados deixam de ser sugeridos como próxima parada, permanecendo pendentes para decisão da cooperativa.
- Após relatar todos os pontos ainda não atendidos, a equipe pode solicitar encerramento com pendências. A solicitação e os relatos notificam a cooperativa. A solicitação não encerra a rota.
- No painel, em editar/planejar rota, a seção “Pendências e encerramento da execução” mostra os pontos, relatos, resumo e histórico. Exige justificativa, conferência explícita e revisão atual da execução.
- Antes da saída e sem atividades realizadas, “Reagendar esta execução” preserva o mesmo registro, atualiza os agendamentos pendentes e registra programação anterior e nova data.
- “Reagendar somente os pontos pendentes” encerra os atendimentos não feitos na execução original e cria uma execução de continuidade somente com esses pontos. Preserva solicitante, origem, equipe, participantes e materiais previstos, sem copiar peso, produção, comprovantes ou entradas reais.
- “Cancelar execução” cancela somente atendimentos ainda pendentes/em andamento sem material ou coleta registrada. Se houver alguma coleta realizada, a execução fica COMPLETED com desfecho PARTIAL (“Encerrada com pendências”); sem coleta realizada, fica CANCELLED/NOT_PERFORMED.
- Coletas COLLECTED, RECEIVED, SORTING e COMPLETED e todos os seus dados permanecem na execução original. Materiais, entradas, lotes, destinações, comprovantes e indicadores de produção não são regravados pela decisão.
- A continuidade possui link para a execução original, e o histórico original aponta para a nova execução. O plano recorrente e as demais execuções não são modificados. A data-identidade da ocorrência recorrente original é preservada para impedir recriação automática daquele dia.
- Os relatórios de não atendimento continuam no histórico mesmo se o ponto for posteriormente atendido. Só pendências ainda atuais recebem o aviso de decisão pendente.

## Uso operacional

1. Em campo, a equipe abre **Minhas rotas**, escolhe a execução e relata **Visita não realizada** nos pontos não atendidos.
2. Quando os pontos restantes estiverem relatados, usa **Solicitar encerramento com pendências**.
3. A cooperativa abre **Gestão de Rotas → Rotas cadastradas → editar/planejar execução**. Na seção de pendências, confere os pontos e escolhe reagendar ou encerrar/cancelar somente os não realizados.
4. A equipe deve sincronizar as coletas realizadas offline antes da decisão. A tela apresenta essa orientação; dados ainda não enviados pelo aparelho não podem ser avaliados pelo servidor.
5. A execução original continua disponível no histórico. A continuidade, quando criada, aparece nas rotas agendadas e possui acesso pelo histórico da original.

O catador registra o ocorrido; a cooperativa decide o tratamento. Relatar ou solicitar encerramento exige conexão. Nenhuma nova fila offline foi criada para essas decisões.

## API e persistência

Migração aditiva `20261029010000_route_pending_outcomes`: `Route.operationalEvents` JSONB com padrão `[]`, `closureOutcome` e `closedAt` opcionais. Dados antigos são preservados; não são inventados relatos retroativos.

- `POST /routes/:id/visits/:collectionId/occurrence`: relato idempotente; mantém compatibilidade com clientes antigos sem operationId, porém o novo comportamento é registrar, sem cancelar.
- `POST /routes/:id/request-closure`: equipe autorizada solicita tratamento após relatar cada ponto pendente.
- `POST /routes/:id/resolve-pending`: somente cooperativa proprietária, com action/reason/operationId/expectedRevision e data/hora quando reagendamento.

Transações serializáveis e bloqueio da execução/pontos, validação de proprietário e colaborador ativo, controle de revisão e repetição idempotente. Datas futuras válidas, recursos ativos e conflitos de horário são conferidos antes de reagendar. Inconsistências de material em ponto pendente bloqueiam toda a decisão, com rollback. As próximas execuções não são tocadas.

As telas da cooperativa dentro do App não foram alteradas. Mantidos os enums existentes para compatibilidade; o desfecho parcial é um campo separado.

## Validação

44 verificações passaram: 34 de API (21 regressões de operações em campo e 13 cenários desta entrega), 5 da tela real do catador em Expo web e 5 do painel. Os cenários incluem migração sobre execução antiga, relatos sem cancelamento, permissões, idempotência, revisão desatualizada, três coletas preservadas/dois pontos encerrados, materiais e entradas preservados, reagendamento de somente dois pontos, preservação da recorrência, data inválida, rollback e duas solicitações de encerramento simultâneas.

TypeScript App/API, ESLint dos arquivos App/painel alterados, build API/painel e export Expo web aprovados. UI com API interceptada e dados demonstrativos, em Chromium local. Testes de banco em PGlite descartável, connection_limit=1; não são teste de carga de produção. Sem acesso à VPS ou teste em aparelho físico. O aviso existente de chunk Vite acima de 500 kB permanece.

Testes e instruções em `server/tests/route-pending` do KatuApp. Resultados nesta entrega em JSON.

## Publicação na VPS pelo responsável

Aplicar na ordem, uma linha por comando.

API e migração:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

App web:

```bash
cd /var/www/katua/app && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Reabrir o App e atualizar o painel com Ctrl+Shift+R. Aplicativos nativos instalados precisam da distribuição correspondente; o export web não atualiza o binário.

## Acompanhamento

- [ ] Depois da publicação, tratar a execução vencida de 27/10/2026 com a cooperativa, conferindo antes a sincronização da equipe.
- [ ] Validar em Android/iPhone físico os relatos, retorno ao App e apresentação dos desfechos.
- [ ] Conferir na operação real o acesso à execução de continuidade e as próximas recorrências.
