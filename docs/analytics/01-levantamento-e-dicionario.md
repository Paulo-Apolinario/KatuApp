# Analytics de participação e atendimento — levantamento e dicionário v1

Data: 11/11/2026. Etapa: diagnóstico e especificação, concluída no código; implementação e diagnóstico dos registros de produção ainda não executados.

## 1. Objetivo e alcance

Responder quem participa da coleta seletiva, como a participação evolui e quais demandas aguardam atendimento. A primeira população analítica será de origens identificadas como pessoa física cadastrada ou gerador pequeno/grande. A atuação de catadores e motoristas pertence a uma análise operacional própria.

Um participante pode ser uma pessoa ou uma organização. Os indicadores contam **cadastros de origem identificados**, não uma estimativa de pessoas únicas na cidade. Um gerador pode participar sem possuir acesso ao aplicativo.

Foram lidos schema, fluxos de solicitações, coletas, entradas diretas, O.C. extra, PEVs, relatórios e navegação. Não houve consulta ao banco da VPS, alteração de registros, migração, alteração de endpoints, publicação ou deploy. Portanto, disponibilidade de campos foi verificada; taxas de preenchimento, volumes reais e cobertura histórica **não foram medidos**.

### Referências verificadas

As branches `main` foram consultadas via GitHub em 11/11/2026:

- KatuApp: `a4365a34a7399bb715bc07e439f0f0296ffbb306`.
- Katua_Web: `657636083a26a3e192424fdf65b46010a20f99d7`.

Os 11 arquivos de backend e os três de frontend listados em `fontes-verificadas.json` possuem o mesmo hash de conteúdo nas cópias locais e nessas referências remotas. A branch de trabalho local tem histórico diferente; a comparação foi de conteúdo, não uma alegação de que seu HEAD é o mesmo de `main`. Isso também não comprova qual versão está instalada na VPS.

## 2. Inventário e descobertas

| Fonte | Informação disponível | Limitação para Analytics |
| --- | --- | --- |
| `Collection` | Origem, cooperativa, recebimento, execução, cancelamento e vínculos com solicitação/PEV/equipe | Parte dos vínculos e datas é opcional. Status atual não reconstrói todo o passado. |
| `Schedule` | Gerador, autor, criação, data preferencial/agendada, situação e coleta relacionada | Autor pode ser gestor ou catador. Não representa sempre iniciativa do beneficiário. Não possui histórico completo de transições. |
| `Generator` | Cadastro da origem, tipo, bairro/município/UF e usuário opcional | Endereço e tipo são valores atuais, sem garantia de retrato histórico. |
| `User` e `PersonProfile` | Conta PF, endereço textual e endereços salvos em JSON | PF não tem vínculo direto exclusivo com uma cooperativa nem bairro obrigatório estruturado. Não listar todos os usuários PF para uma cooperativa. |
| `CollectionMaterial` | Material, unidade, quantidade e vínculo com entrada de resíduos | Uma operação pode ter muitos materiais. O join não pode multiplicar participações. |
| `IntakeDeliverer` | Cadastro local do entregador e vínculo com entradas diretas | Não possui vínculo com conta PF nem classificação de papel. Não equivale automaticamente a morador; pode ser trabalhador ou intermediário. |
| `ExtraCollectionOrder` | Origem informada, gerador opcional, autor, coleta/solicitação relacionadas e eventos | PF sem cadastro só possui dados declarados. O autor é o catador, não o doador. |
| `PevRequest` | Autor, ponto, situação, coleta e atualizações | Comunicar condição de PEV não comprova entrega de material por seu autor. |
| `Bin` | Bairro/município, estado atual, horários e materiais aceitos | Local do ponto não é bairro de residência de seus usuários. Existência de PEV não comprova cobertura histórica do serviço. |
| `CollectionParticipant` | Catadores e alocações por coleta | Executores não devem ser contados como moradores que doaram o material. |
| `InboxNotification` | Criação e leitura de notificações | `readAt` mede leitura, não login, resposta, entrega ou participação. |

### Diferenças que afetam o cálculo

1. `registerIntake` cria uma entrada `DIRECT` como `RECEIVED`, com `receivedAt`, **antes da pesagem inicial**. Recebimento confirmado e quantidade conferida são indicadores diferentes.
2. A aprovação de O.C. extra pode criar `Schedule.requestedByUserId = reporterUserId`, isto é, o catador que relatou a operação. Não atribuir a origem a esse usuário.
3. A tela residencial já usa recebimentos para parte de seus totais. Seu agrupamento mensal utiliza fallback de datas e é de uso do próprio PF; não reutilizar essa seleção como definição do novo Analytics.
4. Os relatórios atuais consideram `COLLECTED` entre as operações executadas. O novo indicador de participação confirmada exige recebimento, por decisão de produto registrada abaixo.
5. Não foi encontrado no schema um histórico próprio de acessos ao aplicativo. Eventos de agentes, notificações e entregas de e-mail não substituem essa instrumentação.

## 3. Regras de identidade

Todas as chaves incluem a cooperativa autorizada no backend. O cliente não escolhe uma cooperativa para ampliar seu acesso.

| Caso | Tratamento v1 |
| --- | --- |
| `Collection.generatorId` válido e da mesma cooperativa | Origem `GENERATOR:<id>`, tipo atual `SMALL` ou `LARGE`. Usar o gerador mesmo quando gestor/catador criou o registro. |
| Sem gerador, sem PEV e sem entrada direta; solicitação vinculada e autor com papel atual `PF` | Origem `PF:<userId>`. Conferir a cooperativa da solicitação e sua relação com a coleta. |
| Coleta de PEV | Contar a operação e o ponto. Não converter o autor do aviso em doador nem inferir quantas pessoas depositaram material. |
| Entrega direta com `intakeDelivererId` | Contar a operação e, separadamente, o cadastro local de entregador. Fora do KPI principal de PF/geradores até existir classificação/vínculo explícito. |
| O.C. de PF sem vínculo persistente com conta | Contar a operação como origem não atribuída à população v1, ainda que haja nome/telefone/endereço no relato. |
| Sem vínculo suficiente ou relações conflitantes | Preservar a operação no total físico; excluir dos indicadores de pessoa e apontar a limitação na qualidade. |

Não juntar cadastros por nome, telefone, endereço ou documento extraído de texto. Não mesclar `IntakeDeliverer`, PF e gerador automaticamente. Mesmo uma deduplicação futura deverá ser explícita, verificável e adequada à finalidade. O tipo de usuário atual não é uma prova do tipo que possuía em uma data passada.

Se a mesma operação tiver vínculos incompatíveis, por exemplo PEV e gerador simultaneamente, marcá-la para revisão em vez de aplicar silenciosamente a precedência. Uma coleta ligada a uma solicitação de outra cooperativa não pode expor dados dessa outra organização.

## 4. Evento e período de referência

Versão da definição: `participation-v1`. Unidade de contagem operacional: `Collection.id` distinto.

**Participação operacional confirmada:** status atual em `RECEIVED`, `SORTING` ou `COMPLETED`, `receivedAt` válido e não futuro. `PENDING`, `IN_PROGRESS`, `COLLECTED` e `CANCELLED` não entram. Uma operação recebida pode contar mesmo que a pesagem esteja pendente; isso precisa permanecer visível.

- Data principal: `receivedAt`. Não substituir silenciosamente por `createdAt`, `collectedAt` ou `completedAt`.
- Material, lote, comprovante e O.S. não são novas participações.
- Recebimento sem data: excluir dos gráficos por data e exibir em qualidade, com alcance histórico explicitado.
- Datas de realização podem anteceder a criação da coleta em relatos retroativos de O.C.; essa ordem não é, isoladamente, prova de erro.
- Status incoerente, data futura ou vínculos conflitantes: contar em qualidade, sem atribuição automática a participante.

Usar datas civis no fuso `America/Fortaleza`. Período com início inclusivo e término exclusivo no início do dia seguinte à data final. Para o dia atual, limitar ao instante da consulta e sinalizar período parcial. Não comparar um dia parcial com outro completo como se fossem equivalentes.

Atalhos de 7/30/60 dias são janelas móveis sobrepostas; não somar seus totais. O padrão será últimos 30 dias, incluindo hoje, com aviso de parcialidade. Comparações exigem mesma duração e cobertura; base anterior zero produz “Sem base de comparação”, não crescimento infinito.

Recência e primeira participação usam todo o histórico confiável disponível até o fim efetivo da consulta. O filtro de bairro/perfil não pode fabricar uma “primeira participação” ao ocultar registros anteriores.

### Limite da leitura histórica

V1 é uma **visão do estado atual organizada pelas datas dos eventos**, não uma reconstrução imutável de “como o sistema estava” no passado. Alterações de cadastro, cancelamentos, correções e recebimentos retroativos podem alterar um relatório de período anterior.

Uma previsão futura exigirá distinguir quando o fato ocorreu de quando ficou disponível ao sistema, além de snapshots/eventos adequados. Não reconstruir variáveis históricas de treinamento apenas com `updatedAt` ou com o status atual.

## 5. Dicionário de indicadores

`E(P)` = operações confirmadas no período. `I(P)` = subconjunto atribuível a PF/geradores pela regra de identidade. `K(P)` = chaves distintas de origem em `I(P)`. `primeira(k)` = menor `receivedAt` confiável da origem na cooperativa em todo o histórico disponível.

| Indicador | Definição e apresentação |
| --- | --- |
| Recebimentos confirmados | `count(distinct Collection.id)` em `E(P)`. Inclui PEV, anônimos e entregas diretas. |
| Participações atribuídas à população v1 | Operações em `I(P)`. Não confundir com número de participantes. |
| Participantes ativos | `count(K(P))`. No resumo, deixar explícito “PF e geradores identificados”. |
| Primeira participação registrada | Ativos cuja `primeira(k)` ocorreu no período. Não significa primeira participação da vida real. |
| Já participavam | Ativos cuja `primeira(k)` ocorreu antes do período. Partição complementar aos primeiros registros: `ativos = primeira registrada + já participavam`. |
| Repetiram no período | Origens com pelo menos duas operações distintas no período. Indicador complementar que pode sobrepor os dois anteriores; não somá-lo como partição. |
| Participações 7/30/60 | Contar operações atribuídas à origem em cada janela, terminando na referência escolhida. Mostrar janelas separadas. |
| Recência | Diferença em dias civis entre a referência e o último recebimento confiável da origem até essa referência. Sem evento: “Sem participação registrada”, nunca um número arbitrário alto. |
| Evolução semanal/mensal | Operações confirmadas e origens ativas por intervalo, como séries distintas. Sem cobertura confiável: lacuna informada, não zero fabricado. |
| Intervalo típico | Mediana dos intervalos, em dias civis, entre datas distintas de participação. Exigir pelo menos três datas para expor regularidade; com menos, “Histórico insuficiente”. |
| Variabilidade | Desvio-padrão populacional dos mesmos intervalos, acompanhado de quantidade de intervalos e mediana. Não criar rótulo de abandono a partir desse número. |
| Modalidades distintas | Quantidade de modalidades comprovadas para a mesma origem. Material diferente não constitui modalidade. Identificação parcial dos canais impede prometer cobertura completa. |
| Demandas registradas | `Schedule.id` distinto criado no período, separando autoria direta de registro por terceiros quando comprovável. Não chamar toda demanda de iniciativa espontânea do beneficiário. |
| Solicitações abertas | Demandas criadas no período que continuam abertas hoje e sem recebimento confirmado. Rótulo obrigatório: “Situação atual, criadas no período selecionado”. Não apresentar como fila histórica da data final. |
| Situação das demandas | Contagem por status atual dos registros criados no período. Não chamar de taxa de conversão sem definir coorte e tempo de observação. |
| Espera atual | Tempo desde a criação para demanda ainda aberta. Agendamento futuro não é atraso; data preferencial não é promessa de atendimento. |
| Recebimento após solicitação | Mediana de `receivedAt - Schedule.createdAt` para pares válidos. Excluir e contabilizar diferenças negativas de registros retrospectivos; não inventar duração zero. |
| Quantidades por unidade | Somar materiais da operação sem duplicar contagem de operações. KG e TON podem formar massa em kg; LITER, UNIT e CUBIC_METER permanecem separados. Valores declarados, pesagem inicial e revisão devem manter sua procedência. |
| Leitura digital | Somente fatos digitais comprovados, como `InboxNotification.readAt`, com finalidade e permissões definidas. Não publicar “último acesso” sem registro de acesso. Fica fora do MVP. |

Para um futuro retorno em 30 dias após primeira participação, o denominador só poderá incluir origens com 30 dias completos de observação. Esse indicador de coorte está fora do primeiro resumo.

## 6. Solicitações e modalidades

Fila principal usa `Schedule` em `REQUESTED`, `SCHEDULED` ou `IN_PROGRESS`, ainda sem coleta confirmada. Solicitação aberta associada a coleta cancelada ou situação contraditória precisa ficar identificada para revisão; não apagar a demanda automaticamente na análise.

O.C. extra com `sourceScheduleId` e coleta vinculada não acrescenta uma segunda demanda. O.C. extra sem solicitação aprovada permanece em uma fila própria de análise; não contar seu protocolo e o Schedule gerado como duas solicitações de material.

`PevRequest` possui estados próprios (`OPEN`, `ASSIGNED`, `RESOLVED`, `DISMISSED`) e deve ter quadro separado. Um chamado resolvido pode se referir à condição do ponto, não a uma entrega individual. Avisos de vários usuários sobre o mesmo PEV não são várias doações.

Modalidades candidatas: coleta vinculada a solicitação, entrega direta e coleta avulsa. Uma O.C. é a forma de registrar/autorizar a operação, não necessariamente um novo canal físico. Coletas de PEV ficam na dimensão “ponto atendido”.

## 7. Bairro e contexto operacional

Gerador e PEV possuem bairro estruturado atual. PF, origem de O.C. sem cadastro e entrada avulsa podem conter apenas endereço livre ou coordenadas, sem bairro.

- Não deduzir bairro pela separação de vírgulas do endereço, por CEP parcial ou pela localização da cooperativa.
- No MVP, usar bairro estruturado do cadastro quando disponível e marcar a fonte como “Cadastro atual”. Sem fonte: “Bairro não informado”.
- Bairro de um PEV corresponde ao ponto, não à residência de seus doadores. Não misturar essas duas distribuições.
- Normalizar espaços, caixa e acentos para agrupamento sem fundir municípios/UF diferentes; preservar um rótulo legível. Revisão explícita para abreviações ambíguas.
- Contar por bairro operações, origens identificadas e registros sem bairro. Exibir denominadores de cobertura. Volume absoluto não comprova maior adesão da população.
- O denominador de PFs cadastrados no município não está estabelecido para uma cooperativa; não usar todos os PFs do sistema para calcular adesão territorial.
- “Cobertura do serviço” e disponibilidade histórica de horários/rotas necessitam uma base própria. Até lá, apresentar pontos e rotas registrados, sem dizer que toda a região está atendida.

Snapshot estruturado de local do evento pode ser uma evolução futura, sem tornar endereço obrigatório nos fluxos em que já foi autorizado como opcional.

## 8. Mapeamento das nove variáveis da reunião

| Grupo | Viabilidade verificada | Encaminhamento |
| --- | --- | --- |
| Histórico | Campos e vínculos existentes | Calcular após diagnóstico da identificação e das datas. |
| Recência | Recebimentos existentes | Regra de data única, sem fallback silencioso. |
| Regularidade | Derivável com histórico suficiente | Exigir amostra e distinguir dias de operações. |
| Diversidade | Parcial | Padronizar canal e manter entregador/PEV fora de inferências pessoais. |
| Contexto operacional | Parcial | Organizar cobertura antes de associar baixa frequência a desinteresse. |
| Temporalidade | Datas existentes | Semana/mês; sazonalidade anual exige histórico comparável e cobertura. |
| Interação digital | Leitura de notificações existe; acessos não confirmados | Não usar no MVP. Projetar instrumentação mínima separadamente. |
| Histórico de solicitações | Disponível com limites | Diferenciar autor, origem, representação e demanda retrospectiva. |
| Qualidade dos dados | Campos permitem diagnóstico | Medir antes de divulgar percentuais ou afirmar que a base está completa. |

## 9. Plano de diagnóstico somente de leitura

Executar em ambiente autorizado, com escopo da cooperativa e resultado agregado, sem nomes, CPF, telefone, e-mail, endereços livres ou payloads completos. Capturar uma referência de tempo consistente para todas as consultas. Registrar execução, versão das regras e alcance de cada denominador.

Contadores a produzir:

1. Total de operações por status e primeira/última data de recebimento válida.
2. Recebidos sem data, datas futuras e relações entre cooperativas inconsistentes.
3. Recebimentos no período: atribuíveis a gerador, atribuíveis a PF, entregador local, PEV, sem vínculo e vínculos conflitantes, como categorias disjuntas de cobertura.
4. Operações recebidas sem material com quantidade positiva registrada. Separar peso legado positivo sem classificação; zero padrão não comprova pesagem.
5. Identificações por vínculo persistente e registros baseados apenas em texto.
6. Operações/pontos com e sem bairro estruturado, distinguindo cadastro atual de local do evento.
7. Solicitações por status/autor, sem coleta, com coleta recebida e com divergência de status.
8. O.C. com/sem `sourceScheduleId` e `collectionId`; solicitações de PEV separadamente.
9. Histórico suficiente para regularidade: menos de três datas vs. três ou mais.
10. Contagens que reconciliem total recebido, atribuição individual, operações excluídas e material por unidade.

Ausência de banco autorizado ou de dados retorna “Não avaliado”; não preencher um relatório real com dados demonstrativos. Este plano foi preparado, **não executado contra produção**.

## 10. Contrato proposto para implementação

Novo módulo de backend `analytics`, mantendo o módulo `reports` existente. Endpoints propostos, ainda não criados:

- `GET /analytics/participation/context`: filtros disponíveis na cooperativa, definição e cobertura.
- `GET /analytics/participation/overview`: indicadores, séries e qualidade com início/fim e filtros validados.
- `GET /analytics/participation/participants`: lista paginada de origens PF/geradores acessíveis.
- `GET /analytics/participation/participants/:kind/:id`: linha do tempo dentro do escopo autorizado.

Metadados obrigatórios: `definitionVersion`, `generatedAt`, `referenceAt`, `timezone`, `readMode: CURRENT_STATE_BY_EVENT_DATE`, período efetivo, população, filtros aplicados e limitações. Métricas indisponíveis usam `null` com motivo; zero exige uma consulta válida com ausência de ocorrências. Resumo sem dados pessoais; detalhes conforme acesso da cooperativa.

Reutilizar a política de escopo validada por `reportScope`, sem copiar o conjunto `EXECUTED` como confirmação de participação. Validar acesso também nos detalhes, filtros e exportações. Nunca usar só IDs fornecidos pelo navegador.

Consultas devem agregar no PostgreSQL e paginar detalhes. Não carregar todas as coletas/materiais no navegador nem truncar totais silenciosamente. A primeira ocorrência e a última data exigem consultas históricas além da janela visível. Avaliar índices compostos após plano de consulta e volume; nenhuma migração foi criada nesta etapa.

## 11. Cenários de aceitação

| Situação | Resultado esperado |
| --- | --- |
| Solicitação, coleta, três materiais, dois lotes e vários documentos | Uma participação operacional confirmada. |
| Gestor cria solicitação para gerador sem conta | Origem é o gerador; gestor não é participante doador. |
| Catador registra O.C. sem vínculo PF persistente | Catador não vira doador PF. Operação pode contar; atribuição pessoal fica indisponível. |
| Pessoa avisa que PEV está cheio | Aviso de serviço; não comprova doação individual. |
| Duas entregas no período, primeira registrada no mesmo período | Um ativo, um primeiro registro, um que repetiu no período, zero “já participavam”. |
| Uma entrega anterior e outra no período | Um ativo que já participava; não é novo por causa do filtro. |
| Recebido sem data | Qualidade; sem ponto inventado na série temporal. |
| Entrada direta recebida ainda sem pesagem | Uma operação recebida; quantidade pendente, sem peso inventado. |
| Mesmo nome em duas origens sem vínculo | Não mesclar automaticamente. |
| Usuário solicita ID de outra cooperativa | Nenhum dado ou existência de entidade deve ser exposto. |
| Participante com duas datas apenas | Recência disponível; regularidade como histórico insuficiente. |
| Demanda em aberto com agendamento futuro | Aberta, sem rótulo automático de atraso. |
| Histórico sem eventos suficientes | Sem previsão nem classificação de abandono. |

## 12. Sequência de entrega

1. Concluído: inventário de código, verificação das fontes em `main`, dicionário, limites e especificação da tela.
2. Pendente: diagnóstico agregado do banco no ambiente autorizado e avaliação dos resultados reais.
3. Pendente: serviço analítico, controle de acesso e cenários de cálculo automatizados conforme este contrato.
4. Pendente: tela abaixo de Configurações, integrada aos dados, com estados de ausência e cobertura.
5. Posterior: canais mais completos, cobertura operacional, interação digital e avaliações temporais para previsão.

Nenhum serviço de IA, envio de mensagens, ranqueamento de trabalhadores ou decisão automática faz parte do primeiro módulo.

## Fontes de código

- [Schema](../../server/prisma/schema.prisma)
- [Ciclo da coleta e entrada direta](../../server/src/modules/collections/collection.service.ts)
- [Solicitações](../../server/src/modules/schedules/schedule.service.ts)
- [O.C. extra](../../server/src/modules/extra-collection-orders/extra-order.service.ts)
- [Entradas avulsas](../../server/src/modules/material-intakes/material-intakes.routes.ts)
- [Entregadores](../../server/src/modules/intake-deliverers/intake-deliverers.routes.ts)
- [Visão residencial](../../server/src/modules/residential/residential.routes.ts)
- [Definições de relatórios atuais](../../server/src/modules/reports/reports.model.ts)
- [Escopo atual dos relatórios](../../server/src/modules/reports/reports.service.ts)
