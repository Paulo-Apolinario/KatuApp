# Operações em campo e agrupamento das rotas fixas

Data: 28/10/2026. Entrega: API, banco e painel. As telas do App permanecem sem alterações.

## Problema e resultado

A confirmação de saída atualizava a execução da rota, mas o painel observava somente o início individual das coletas. Por isso, uma rota já iniciada podia aparecer com pontos Pendentes e o cartão Operações em campo continuar em zero.

Agora a saída da rota é reconhecida como operação em campo. Os pontos que ainda não foram atendidos aparecem como **Em campo — Aguardando atendimento neste ponto**. Quando o catador inicia o atendimento daquele local, o ponto aparece como **Em atendimento**. Recebimento, conferência, materiais e histórico continuam vinculados a cada coleta individual.

## Backlog entregue

- [x] Separar a Lista de Coletas em abas Coletas normais e Rotas fixas, preservando a navegação existente.
- [x] Apresentar um tópico por execução/data da rota fixa, identificado pelo ID da execução. Datas diferentes do mesmo plano não são mescladas.
- [x] Expandir o tópico para consultar PEVs, geradores e endereços avulsos, com responsável, etapa e botão Ver detalhes de cada ponto.
- [x] Manter o recebimento e a conferência de um ponto independentes dos demais. Agrupar a apresentação preserva IDs, pesos, entradas e destinações.
- [x] Reconhecer a rota em campo imediatamente na consulta operacional após a saída, sem iniciar artificialmente todos os pontos ou inventar horários individuais de atendimento.
- [x] Contar cada rota iniciada uma única vez no cartão Operações em campo. Coletas individuais iniciadas são contadas separadamente; pontos de uma rota já contada não entram novamente.
- [x] Informar no cartão a composição entre rotas fixas, outras rotas e coletas individuais. Disponibilizar atalhos para acompanhar a execução correta e seus pontos.
- [x] Manter uma rota no indicador até seu encerramento operacional, inclusive quando os atendimentos de seus pontos já terminaram.
- [x] Atualizar os textos de situação na agenda e nos registros recentes do painel, preservando a etapa real da coleta na API.
- [x] Retirar os pontos com saída confirmada da fila de pendentes sem saída; oferecer filtro Em campo e escopo Somente operações em campo.
- [x] Paginar execuções inteiras no servidor e carregar seus pontos somente ao expandir, com paginação própria e sequência de visitas preservada. Execuções em campo têm prioridade nas páginas.
- [x] Pesquisar a execução por seus pontos, incluindo nome/endereço avulso, e reconhecer colaboradores participantes no filtro de catador.
- [x] Preservar a identificação de execução fixa histórica por executionDate quando o plano não estiver mais vinculado.
- [x] Recolher filtros auxiliares de origem, equipe e período para reduzir o conteúdo inicial; indicar filtros ativos.
- [x] Adaptar os pontos expandidos a cartões no celular, mantendo etapa e ação acessíveis sem exigir leitura de uma tabela larga.
- [x] Limitar as opções de tamanho de página ao que a API aceita nas novas consultas.
- [x] Registrar a primeira saída em Route.startedAt e preservá-la em confirmações repetidas.
- [x] Manter isolamento entre cooperativas e autorização de perfil nas consultas agrupadas e nos detalhes.

## Definição dos indicadores e filtros

**Operações em campo** soma rotas IN_PROGRESS e coletas IN_PROGRESS que não pertencem a uma rota já em campo. Uma rota com oito pontos conta uma operação; iniciar um desses pontos não cria outra operação no cartão. O detalhamento informa as visitas encerradas e os pontos restantes.

**Aguardando recebimento** continua medindo coletas/pontos concluídos em campo e ainda não recebidos, pois o recebimento e a pesagem são individuais. Concluir a execução da rota não equivale a concluir a destinação dos resíduos.

A aba Rotas fixas seleciona execuções pelos filtros de seus pontos. Ao expandir uma execução, todos os seus pontos ficam disponíveis para manter o contexto completo. Os totais dessa aba consideram os pontos das execuções encontradas e mantêm kg, litros e outras unidades separados. Coletas canceladas não compõem o total de quantidades.

A atualização automática do resumo operacional ocorre a cada 30 segundos com a aba visível; a atualização manual continua disponível. Não foi implantado rastreamento por GPS nem comunicação em tempo real por WebSocket nesta entrega.

## Migração e compatibilidade

Migração aditiva: `20261028030000_route_field_operations`. Acrescenta Route.startedAt e índices para consultas por cooperativa, status, plano e programação.

Não modifica os status ou pesos históricos das coletas. Execuções já em andamento passam a ser reconhecidas pela situação da rota mesmo sem horário histórico de saída; startedAt permanece vazio quando não é conhecido. O horário é registrado nas novas transições para Em campo, sem ser sobrescrito por repetição da confirmação.

A API continua preservando os códigos de etapa de cada ponto. IN_FIELD é um filtro/contexto de apresentação, não um novo status gravado em Collection. Não há fusão de coletas, de lotes ou de entradas de resíduos.

## Validação

57 verificações aprovadas: 21 de API/migração desta entrega, 7 de interface, 6 de regressão do fluxo de saída e 23 de regressão de resíduos. Foram cobertos agrupamento e paginação, datas diferentes do mesmo plano, sequência dos pontos, operações sem dupla contagem, conferência individual com justificativa, endereços avulsos, participantes, permissões e isolamento entre cooperativas.

TypeScript e build da API, ESLint e build do painel aprovados. Interface revisada em desktop e largura de 390 px. O aviso preexistente de bundle maior que 500 kB permanece no painel. Testes locais com dados descartáveis, sem acesso à VPS ou ensaio em aparelho físico.

Resultados: `docs/validacao-operacoes-campo-2026-10-28.json`. Reprodução: `server/tests/field-operations/README.md` no KatuApp.

## Aplicação na VPS

Atualizar KatuApp/main, instalar dependências do servidor, gerar Prisma Client, aplicar migrações com `npm run prisma:deploy`, verificar/compilar API e reiniciar `katua-api.service`. Atualizar Katua_Web/main e compilar o painel. Não é necessário exportar novamente o App nesta entrega.

Após atualizar, abrir Lista de Coletas → Rotas fixas. Uma execução já em campo deve aparecer em um tópico, com seus pontos ao expandir, e integrar o cartão Operações em campo sem exigir uma nova saída.
