# Rotas fixas, pontos por endereço e sequência no aplicativo — 26/10/2026

## Objetivo e autorização

Entrega autorizada por Paulo nos repositórios KatuApp (API e Expo) e Katua_Web (painel), na main. Implantação na VPS continua com o responsável. O roteiro recorrente é separado das execuções de cada data: ativar a programação não registra uma saída fictícia da equipe.

## Entregue

- [x] Área **Rotas fixas**, acessível pelo menu Gestão de Rotas; navegação para Programação e Histórico.
- [x] Frequência semanal/quinzenal, dias da semana, início/fim de vigência, saída e duração previstas, exceções por data e programação ativa/pausada.
- [x] Geração automática pela API a cada minuto e ao salvar/conferir um roteiro: janela de sete dias, no fuso America/Fortaleza, sem recuperar saídas passadas. Falhas de recursos/conflitos são exibidas no roteiro.
- [x] Chave única roteiro/data e transações serializáveis para não duplicar execuções. Motorista/veículo podem ser definidos depois; a saída exige os recursos válidos e coleta operacional, conforme a regra anterior.
- [x] Equipe de catadores, com responsável padrão e responsável específico por ponto; mesma sequência disponível ao motorista e aos catadores vinculados.
- [x] Pontos vinculados diretamente a PEVs e geradores da cooperativa; pontos avulsos sem exigir conta de pessoa física ou cadastro de gerador.
- [x] CEP via ViaCEP, rua, número/complemento, bairro, município, UF, nome, telefone opcional, materiais previstos e orientações. Mapa com pino e confirmação explícita da localização.
- [x] Busca geográfica pelo endereço quando a chave Google já utilizada no painel estiver configurada; seleção manual no mapa/coordenadas permanece disponível. CEP sozinho não inventa coordenadas.
- [x] Novo PEV/gerador pode ser cadastrado em outra aba; botão **Recarregar cadastros** atualiza as opções sem apagar o planejamento.
- [x] Dias específicos por ponto do roteiro fixo. Sem seleção específica, participa de todos os dias programados do roteiro.
- [x] Incluir, editar, retirar e ordenar pontos. Remover vínculo não exclui o cadastro de origem. Em execução avulsa, novos pontos e coletas existentes podem ter sequência intercalada.
- [x] Escopos: edição da execução selecionada; edição do roteiro para novas gerações; opção explícita de aplicar o roteiro às futuras já geradas e ainda não iniciadas.
- [x] Na aplicação às futuras, pontos antigos ficam cancelados e identificados como substituídos, preservando o histórico. Coletas avulsas previamente vinculadas são preservadas; se a execução for cancelada pela revisão, pendentes avulsas são liberadas para novo planejamento.
- [x] Execuções iniciadas ficam fora da aplicação em lote. Se a rota ainda estiver agendada mas já houver coleta iniciada, o lote é recusado para revisão individual. Não se alteram endereços de coleta iniciada ou finalizada.
- [x] Conflitos por sobreposição de intervalos previstos para equipe/veículo. Rotas antigas sem horário continuam com o aviso por data do planejamento existente; não há promessa de previsão precisa sem duração real.
- [x] Telas antigas de criar/editar delegação redirecionadas ao planejamento oficial; a lista de delegação já utiliza as rotas reais. Não há manutenção de um segundo cadastro de equipe pela API antiga.
- [x] Pontos originam agendamento interno e coleta pendente, com snapshot de nome/endereço/coordenadas. Materiais previstos são orientações; peso, materiais efetivos e estoque só surgem na operação normal da coleta.
- [x] Nome e endereço do ponto preservados no planejamento, na fila do catador, no painel de coletas e nos comprovantes individuais.
- [x] Tela **Minhas rotas** no app: próxima parada, lista numerada, situação, equipe, veículo, saída/destino, progresso, confirmação de saída e encerramento.
- [x] Navegação externa até o ponto pelo Google Maps; botão **Atender este ponto** abre a coleta correta para o catador responsável. Motorista não recebe essa ação exclusiva.
- [x] Visita não realizada com justificativa (fechado, sem material, acesso impedido etc.) encerra o atendimento como cancelado, sem gerar peso, entrada ou lote. Uma coleta já iniciada exige o tratamento operacional existente.
- [x] “Deixar para depois” altera a indicação local de próxima parada sem reescrever a sequência oficial. Atualização da execução a cada 30 segundos enquanto a tela estiver em primeiro plano.
- [x] Avisos persistentes no sino para programação/alteração de rota, com atalho para abrir a execução. Notificações de coleta e conferência de quantidades continuam funcionando.
- [x] Cache da sequência e dos detalhes por usuário, preservado quando a listagem resumida é atualizada. Conclusões pendentes na fila offline prevalecem na indicação local; saída, encerramento de rota e ocorrência de visita exigem conexão.
- [x] Caminho do catador **/(catador)/roteiro** distinto do motorista **/(motorista)/rotas**, evitando conflito de resolução do Expo no recarregamento do navegador.

## Sequência por ruas

Botão **Sugerir melhor sequência por ruas**, com confirmação antes de enviar coordenadas ao provedor OSRM configurado. Não transmite nomes, telefones ou materiais. Saída e destino são configuráveis, inclusive retorno à sede.

A API consulta matriz de distâncias pelas ruas, aplica heurística de vizinho mais próximo e melhorias por inversão de segmentos, compara com a ordem original e mantém a de menor custo encontrado. Em seguida consulta o percurso rodoviário da sequência resultante e apresenta traçado, quilômetros e tempo estimado de deslocamento. Não afirma ótimo global nem economia garantida de combustível. Falha do serviço preserva a ordem manual; não há estimativa substituta em linha reta. Coordenadas ausentes, pontos sem ligação rodoviária e afastamento superior a 500 m da via encontrada geram erro explícito. Até 60 pontos por cálculo e dez solicitações por minuto por usuário/processo.

Variáveis no **server/.env**, sem credenciais no repositório:

```dotenv
ROUTING_OSRM_URL=https://router.project-osrm.org
ROUTING_OSRM_PROFILE=driving
```

Esse endereço padrão é de demonstração. Para operação contínua, configurar instância própria ou contratada compatível; não há SLA assumido para o serviço público. `ROUTING_OSRM_URL=disabled` mantém somente o planejamento manual. Nenhuma instalação de OSRM na VPS foi executada nesta entrega.

As estimativas não incluem atendimento nos pontos, trânsito ao vivo, restrições específicas de caminhão ou otimização com janelas de atendimento. A partida/destino e os marcadores precisam ser revisados pela cooperativa.

Referência primária: [contrato HTTP oficial OSRM](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md) — serviços table e route. Testes usam provedor local controlado; não comprovam cobertura rodoviária ao vivo nos municípios.

## Persistência e API

Migração obrigatória: **20261026120000_recurring_routes**.

Adiciona RoutePlan, vínculo/identificador de execução recorrente, equipe, partida/destino, horário/duração e revisão em Route; snapshot routePoint/routePointKey em Collection. Migração aditiva, sem apagar os registros existentes. A chave única Route(planId, executionDate) impede nova geração da mesma execução, mesmo se cancelada.

Principais endpoints autenticados:

- GET/POST /route-plans e PATCH /route-plans/:id — gestão exclusiva da cooperativa; expectedVersion obrigatório nas revisões.
- POST /route-plans/:id/generate — conferir geração; GET /route-planning/sources — cadastros da própria cooperativa.
- POST /route-planning/optimize — coordenadas e sequência sugerida, sem gravar automaticamente.
- POST /routes/:id/field-status — confirmação pelo motorista/catador vinculado, com autorização revalidada dentro da transação.
- POST /routes/:id/visits/:collectionId/occurrence — motivo obrigatório, somente antes de iniciar a coleta e em execução em andamento.
- POST/PATCH /routes — plannedPoints, pointUpdates, visitOrder, collectorIds, startPoint, endPoint, departureTime, estimatedMinutes e expectedRevision, preservando os clientes anteriores.

Rotas extras e OCs existentes continuam independentes quando não vinculadas a uma execução. Vincular coleta já existente não cria outra. O cadastro recorrente gera novos atendimentos por data; não incorpora automaticamente solicitações avulsas recebidas para o mesmo endereço. A cooperativa deve revisar essa possível sobreposição na programação.

## Validação

**54 verificações aprovadas:** 23 de integração e painel, oito do roteiro no aplicativo, sete de regressão do planejamento e 16 da central de notificações/cabeçalhos. [Resultados](validacao-rotas-recorrentes-2026-10-26.json).

- TypeScript da API e do app; build da API, build Vite e export Expo Web.
- Lint do app e dos componentes/serviços de painel afetados. Permanece aviso anterior de tamanho do bundle Vite.
- Testes de integração com API Fastify/Prisma real, migração incremental e PostgreSQL descartável PGlite: isolamento de cooperativa, cadastros válidos, geração, idempotência, revisão, pausa, conflito, equipe, endereço, sequência intercalada, ocorrências, notificações e falhas do serviço rodoviário.
- Chromium no painel: desktop e celular, CEP com resposta controlada, confirmação do mapa e seleção de PEV.
- Chromium sobre export Expo real: próxima parada, início, adiamento local, ocorrência, reabertura offline, largura de 320 px e motorista.
- Regressão do planejamento anterior: cadastro, edição, concorrência, histórico, ações operacionais e recuperação de erro.

Scripts: `frontend/tests/recurring-routes.mjs`, `frontend/tests/route-planning-browser.mjs`, `server/tests/recurring-routes/local-server.ts`, `tests/route-execution-browser.mjs`. Fixtures recusam banco externo; capturas foram inspecionadas. Sem acesso à VPS ou banco de produção.

## Implantação pelo responsável

1. Atualizar main de KatuApp.
2. Em /var/www/katua/app/server: npm ci --include=dev, npm run prisma:generate, npm run prisma:deploy, npm run check e npm run build.
3. Reiniciar katua-api.service e confirmar active. O agendador faz parte do processo da API; não depende de PM2 ou cron externo.
4. Atualizar main de Katua_Web, instalar dependências e compilar frontend com VITE_API_BASE_URL=https://vps.katua.com.br.
5. Em /var/www/katua/app, instalar dependências e exportar Expo Web com EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br.
6. Abrir painel e app com recarga sem cache. Cadastrar roteiro com dados reais, conferir as execuções geradas e confirmar o percurso dos pontos antes da saída.

Não sobrescrever .env, uploads, storage ou banco. Não usar prisma db push nem registrar migração como aplicada sem executar o SQL. O serviço deve receber a migração antes de iniciar a nova API.

## Backlog explícito

- [ ] Instância rodoviária própria/contratada e validação ao vivo de cobertura para Fortaleza, Jijoca, Cruz e Sobral.
- [ ] Restrições por dimensão/peso do veículo, trânsito ao vivo e janelas de atendimento no cálculo.
- [ ] Recálculo dos pontos restantes a partir do GPS durante a viagem, com aprovação da cooperativa e controle de versão.
- [ ] Distribuição automática de pontos entre vários veículos/equipes; esta entrega usa uma sequência compartilhada por execução.
- [ ] Navegação com voz dentro do KATUÁ. Nesta entrega, a navegação usa o aplicativo externo.
- [ ] Ocorrência e confirmação de saída pela fila offline, com idempotência própria. Registros normais de coleta continuam com o modo offline existente.
- [ ] Consolidação assistida de solicitações avulsas com pontos recorrentes no mesmo endereço/data.
- [ ] Persistência do traçado rodoviário e de suas estimativas entre recargas. A ordem fica salva; o traçado calculado é exibido durante a sessão de planejamento.
- [ ] Calendário dedicado a edição de recorrência, indicadores de pontualidade/quilometragem real e trilha completa de revisões de roteiro.
