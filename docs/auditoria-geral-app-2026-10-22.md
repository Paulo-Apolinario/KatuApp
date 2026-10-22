# Auditoria geral do aplicativo KATUÁ — 22/10/2026

## Objetivo, escopo e limite

Solicitação: explicar a linha do tempo do catador e revisar a estrutura do app, problemas operacionais, integração, navegação e apresentação visual.

Base: código de KatuApp após as correções do fluxo de coleta/estoque publicadas em `f598f9d21d30ccfb40182955f4c4d4e3069cd339`; painel correspondente `a99e02dfc98f1e277a9bf79e7745b0862e133edc`.

Inventário automatizado de todos os 158 arquivos TypeScript/TSX em `app` e `src`, somando 61.563 linhas e 77 arquivos de rota sem contar layouts. Esses números incluem formatação e não medem complexidade ou quantidade de funcionalidades concluídas. Houve leitura direcionada dos layouts, serviços e fluxos críticos dos cinco grupos: pessoa física, gerador, catador, motorista e cooperativa. Backend e painel foram consultados para confrontar permissões e o ciclo operacional.

Não se trata de teste manual de todas as telas nem de homologação em aparelhos físicos. Não houve acesso à VPS ou aos dados reais. Esta entrega adiciona documentação e provas de diagnóstico, sem modificar funcionalidades de produção.

## Situação da imagem do catador

A imagem `image(20261022-205408).png` mostra:

| Etapa | Situação mostrada | Responsável |
| --- | --- | --- |
| Coleta delegada | Registrada às 11h55 | Cooperativa |
| Coleta iniciada | Registrada às 11h59 | Catador |
| Etapa de campo concluída | Registrada às 12h01 | Catador |
| Recebimento confirmado | Registrado às 17h49 | Cooperativa |
| Triagem iniciada | Pendente | Cooperativa |
| Coleta concluída | Pendente | Cooperativa |

Todas as datas exibidas são 22/10/2026. A imagem indica recebimento já confirmado; não permite verificar por si só o estado atual no banco. As duas pendências são posteriores ao trabalho de campo e não devem ser executadas pelo catador.

No painel atualizado: **Coleta de Resíduo → Lista de Coletas → Ver detalhes**. A ação depende da etapa atual:

1. COLLECTED: conferir a chegada física, marcar a confirmação e usar **Confirmar recebimento**.
2. RECEIVED: marcar a confirmação e usar **Iniciar triagem**.
3. SORTING: conferir entradas e destinações em Gestão de Resíduos; resolver saldo pendente e reservas temporárias; voltar aos detalhes, confirmar e usar **Concluir operação**.

Para a coleta da imagem, o próximo passo é o segundo. O encerramento só ocorre quando o servidor aceita a conferência dos saldos. Atualizar os detalhes no painel e atualizar/reabrir a tela do app após uma transição. A linha do tempo do catador não recebe atualizações por conexão em tempo real: usa carregamento ao entrar/atualizar a tela.

Melhoria recomendada: mostrar **Sua etapa de campo foi concluída** e separar **Etapas da cooperativa**, substituindo o rótulo genérico Pendente por Aguardando triagem da cooperativa e Aguardando encerramento. Incluir horário da última consulta e identificação de dados offline.

## Problemas reproduzidos

As dez provas em `server/tests/app-audit/probes.cjs` executam funções, componentes ou serviços reais transpilados com transporte e armazenamento controlados. O resultado REPRODUCED confirma a ocorrência observada, inclusive defeitos; não significa aprovação do sistema. Evidências em `validacao-auditoria-geral-app-2026-10-22.json`.

| ID | Prioridade | Problema e consequência | Evidência e proposta |
| --- | --- | --- | --- |
| APP01 | P1 | Agendamento PF envia uma lista de nomes; o serviço exige objetos com material de catálogo ou proposta. A solicitação falha antes de chegar à API | `app/(pf-tabs)/schedule.tsx`, `src/services/scheduleService.ts::serializeRequestedMaterials`. Reproduzido Material inválido na posição 1, zero chamadas à API. Alinhar seleção ao catálogo e contrato de propostas/unidades |
| APP02 | P1 | Botão compartilhado de sair usado no perfil PF apenas redireciona; não limpa sessão nem chama signOut | `src/components/LogoutButton.tsx.tsx`, layout PF. Prova aciona o botão de confirmação e observa só router.replace. Usar signOut centralizado e confirmar comportamento no navegador e no nativo |
| APP03 | P1 | `auth/me` com 401 devolve usuário armazenado como se a sessão ainda fosse válida | `authService.getCurrentUserData`. Reproduzido usuário local devolvido após 401, sem limpeza. Separar falha de rede de sessão expirada/revogada; preservar dados pendentes e exigir autenticação. Isto não comprova autorização indevida na API, que continua validando JWT |
| APP04 | P1 | Cache de agendamentos não está associado à conta, ao contrário dos caches de rotas/coletas corrigidos anteriormente | `scheduleRepository.ts`. Após gravar agenda na conta A e entrar na B, a consulta local retorna a agenda de A. Aplicar isolamento por titular, inclusive na retomada offline |
| APP05 | P1 | Comprovantes e normalizadores de materiais ainda usam só quantityKg e imprimem kg | `receipts.tsx::normalizeMaterials`, `pdfGenerator.ts::renderMaterialsTable`, `src/utils/materials.ts`. Entrada de 50 LITER é impressa como 0.0 kg. Preservar quantidade e unidade originais em tela/PDF; consolidar massa apenas para unidades de massa |
| APP06 | P1 | Data impossível é aceita e ajustada para outro dia pelo construtor Date | `app/(pf-tabs)/schedule.tsx::parseDateTimeToIso`. 31/02/2026 aceito como 03/03/2026. Validar componentes, limites de horário, datas passadas e política de fuso antes de enviar |
| APP07 | P2 | Criação de rotas no app permanece baseada em paradas textuais; não envia collectionIds do planejador do painel | `routeService.create`, telas de rotas da cooperativa. Prova fornece collectionIds e constata campo omitido. Adicionar seleção e sequência de coletas reais, vínculo atômico, coordenadas e mapa; respeitar ordem devolvida pelo backend |
| APP08 | P1 | Informar problema no catador chama cancelamento que a API permite somente à cooperativa | `collect.tsx::handleReportProblem`, `CollectionService.cancel`. Reproduzido 403 ONLY_COOPERATIVE_CAN_CANCEL. Criar registro de ocorrência para o catador; cooperativa decide cancelamento, reagendamento ou troca de equipe |
| APP09 | P1 | Origem PEV não é reconhecida pelo mapa do motorista | `mapa.tsx::getCollectionGenerator` lê apenas generator/schedule.generator; normalização do routeService também omite bin. Prova com coleta PEV e coordenadas válidas retorna origem nula. Unificar resolução de origem para PEV, gerador e solicitações, preservando endereços estruturados |
| APP10 | P2 | Percentual de coleta da cooperativa ignora COLLECTED, RECEIVED e SORTING | `app/(cooperativa)/percentual.tsx`. Uma coleta RECEIVED de 100 kg não entra em nenhum grupo. Separar volume coletado, etapas operacionais e saldo de estoque; incluir todas as etapas e todas as unidades aplicáveis |

P1: falha de operação, confiança dos dados ou sessão; P2: integração e consistência; P3: evolução/manutenção. Não foi identificado nem demonstrado um comprometimento crítico que justifique classificar todo o app como inseguro.

## Outros achados confirmados por leitura

| ID | Prioridade | Achado | Ajuste proposto |
| --- | --- | --- | --- |
| APP11 | P1 | Layout do motorista não aplica ProtectedRoute, diferentemente dos outros grupos | Usar proteção de perfil no layout e testar links diretos, sessão ausente e troca de conta. A ausência da barreira de interface não prova que o backend libera dados |
| APP12 | P2 | OperationalMap.web usa iframe centrado em um ponto e lista lateral; não desenha todos os marcadores nem a rota recebida via routeCoordinates | Entregar mapa web interativo com todos os pontos, números de visita, seleção sincronizada, legenda real e sede distinta da posição do aparelho. Linhas de sequência devem ser apresentadas como sequência, não distância viária |
| APP13 | P2 | Outras telas atualizam LastSyncBadge com Date.now após consultas que podem ter devolvido cache | Distinguir última consulta, última resposta online e pendências reais. A tela Coletar já recebeu essa distinção; ampliar para dashboard e mapas |
| APP14 | P2 | NotificationContext espera mensagem e depois título, mas há chamadas com os argumentos invertidos | Padronizar contrato em objeto com title/message/type para evitar títulos longos e mensagens como Atenção ou Sucesso sem contexto |
| APP15 | P2 | Atalho Perfil do catador aponta à própria homecat | Criar perfil real com dados pessoais, cooperativa/OSC, documentos permitidos, preferências e fluxo de recuperação/alteração de senha; impedir prometer navegação inexistente |
| APP16 | P2 | Loja, chat, NFC e loja/estoque da cooperativa são telas em preparação, ainda acessíveis | Ocultar por configuração de funcionalidade ou informar indisponibilidade antes de navegar. Estoque do app não deve ser apresentado como equivalente ao painel enquanto não integrado |
| APP17 | P2 | Ranking PF procura materiais no texto das observações; histórico PF usa solicitações como base | Usar requestedMaterials estruturados para previsão e coleta/material efetivamente registrado para resultados. Definir claramente engajamento, solicitações e coleta concluída |
| APP18 | P2 | `src/services/api.ts` não tem prazo limite/cancelamento das requisições e não centraliza reautenticação em 401 | Adicionar tempo limite e cancelamento, mensagens acionáveis e comportamento por classe de erro, respeitando idempotência nas operações gravadas |
| APP19 | P2 | Há erros que limpam todos os dados de uma tela quando uma chamada do carregamento conjunto falha | Preservar dados anteriores com indicação de desatualização e apresentar falha por seção. Ex.: dashboard da cooperativa com Promise.all |
| APP20 | P2 | Agendamento PF duplica a notificação de erro no carregamento de cooperativas | Um aviso claro com tentar novamente, sem mensagens repetidas |
| APP21 | P2 | Configuração versionada `app/eas.json` contém IP privado nos perfis de teste e endereço de exemplo em produção; o arquivo não está na raiz Expo | Consolidar configuração de distribuição na raiz correta e variáveis por ambiente com a API real. Confirmar o processo usado antes de mudar publicação. Não é evidência de que a versão atualmente instalada tenha sido gerada com esses valores |
| APP22 | P2 | Plugin Android habilita cleartext globalmente | Limitar a necessidade de HTTP ao desenvolvimento e manter publicação em HTTPS; validar chaves públicas do mapa por restrições de aplicativo/domínio no provedor, sem tratá-las como segredo de servidor |
| APP23 | P3 | `src/contexts/SyncContext.tsx`, `src/hooks/useSyncStatus.ts`, `src/offline/operationTypes.ts` e arquivos de tema estão vazios | Consolidar status de sincronização e tema; a fila real está em syncManager/syncEngine, portanto os arquivos vazios não significam ausência de sincronização |
| APP24 | P3 | Dependências de backend no package.json do app, arquivos extensos e cópias de normalização/cores/status | Revisar fronteiras app/server e separar componentes/formatadores. Não atualizar bibliotecas ou reescrever telas apenas pelo tamanho do arquivo |

## Proposta operacional por perfil

| Perfil | Melhorias recomendadas |
| --- | --- |
| Catador | Fila do dia e próxima coleta; orientações da origem; materiais por unidade; ocorrência com motivo e evidência; salvamento de rascunho; pendência de sincronização por coleta; comprovante de campo distinto de conclusão operacional; indicação explícita das etapas da cooperativa |
| Motorista | Roteiro numerado igual ao painel; PEVs e sede; visualização da equipe/veículo; navegação externa; ocorrência vinculada à coleta/rota/veículo; confirmação de saída/retorno e eventos de execução conforme regra aprovada |
| Cooperativa | Central de recebimento e triagem no mobile, ou acesso claro ao painel enquanto indisponível; planejamento de rotas integrado; gestão de pendências e ocorrências; consulta de estoque real sem entrada manual duplicada; veículos ativos compatíveis |
| Gerador | Solicitação com materiais do catálogo; confirmação do endereço e mapa; acompanhamento com previsão e execução separadas; histórico por material/unidade; comprovantes por operação e feedback após atendimento |
| Pessoa física | Corrigir solicitação; definir endereço e área atendida; agenda com calendário; confirmação e protocolo; histórico com significado correto; catálogo real; perfil e saída confiável |

Geolocalização atual acompanha a posição do aparelho em primeiro plano nas telas que usam o hook dedicado. Isso não equivale a rastreamento remoto compartilhado da frota. Se esse acompanhamento for desejado, precisa de transmissão autenticada, precisão/idade da posição, política de retenção e validação do consumo de bateria; localização em segundo plano não deve ser ativada indiscriminadamente.

## Proposta visual e de experiência

1. Criar cores, tipografia, espaçamento, campos, botões e cartões compartilhados, seguindo a linguagem do painel. Os arquivos de tema atuais estão vazios e não são importados pelas telas inventariadas.
2. Substituir títulos extensos em caixa alta e repetição de grandes gradientes por cabeçalhos consistentes, com ação principal evidente e informações operacionais próximas.
3. Respeitar áreas seguras e navegação por gestos. O inventário não encontrou SafeAreaView/useSafeAreaInsets em app/src; há cabeçalhos com padding fixo e Android edgeToEdgeEnabled. Isso indica necessidade de teste em aparelhos, não prova de sobreposição em todos eles.
4. Acessibilidade: rótulos em ícones, estado desabilitado/carregamento, foco em diálogos web, mensagens de erro próximas ao campo, texto ampliado e status com texto/ícone além da cor. Validar contraste e tamanho dos alvos nas telas reais.
5. Mapas com PEV, gerador, sede e posição atual distintos; agrupamento para muitos pontos; aviso de endereço sem coordenadas e de posição antiga/imprecisa.
6. Listas extensas com busca, filtros, carregamento incremental e virtualização onde necessário. Há somente dois arquivos usando FlatList no inventário; medir desempenho antes de substituir listas pequenas.
7. Padronizar estados de carregamento, vazio, erro, offline e dado desatualizado; evitar apresentar zero como resultado confirmado quando a consulta falhou.
8. Separar ações do usuário de acompanhamento de outras equipes. Na imagem do catador, usar texto que explique a responsabilidade, sem induzir que ele tenha de iniciar a triagem.

## Validações executadas

- Inventário estrutural dos 158 arquivos app/src: `inventario-app-2026-10-22.json`.
- Dez provas reproduzidas: `node --import tsx tests/app-audit/probes.cjs`, a partir de server.
- ESLint em `app` e `src`: **zero erros e quatro avisos**, envolvendo dependências de hooks e variável sem uso. Aviso não é falha reproduzida de GPS.
- TypeScript geral: **14 erros**, sendo três em telas do app e onze em fixtures/testes de backend incluídos pelo tsconfig da raiz. Separar configuração app/server/testes e corrigir os contratos. A compilação geral não está aprovada.
- Exportação do bundle JavaScript Android: **concluída**. Não é compilação/instalação de APK/AAB e não comprova GPS, NFC, permissões, navegação ou impressão em aparelho.
- Builds web e testes da versão anterior continuam sendo evidência daquela entrega; não foram usados para afirmar que todas as telas passaram nesta auditoria.

## Plano de execução com critérios de aceite

| Lote | Ordem sugerida | Critério de aceite |
| --- | --- | --- |
| 1 — operação e sessão | APP01, APP02, APP03, APP04, APP06, APP08, APP11 | Solicitação PF criada; sair encerra sessão; 401 exige login; conta B nunca lê agenda da A; datas impossíveis rejeitadas; ocorrência do catador registrada sem cancelamento indevido; links por perfil protegidos |
| 2 — materiais e acompanhamento | APP05, APP09, APP10, APP13, APP14, APP17 | PDF de 50 L mostra 50 L; mapa reconhece PEV/gerador; todas as etapas entram nos indicadores corretos; ausência de rede não atualiza falso horário de sincronização; timeline explica responsáveis |
| 3 — rotas e mapa | APP07, APP12 e planejamento por origem | Mesma sequência do painel; seleção de coletas e vínculo transacional; pontos numerados; sede e GPS distintos; edição preserva execução/histórico e informa coordenadas ausentes |
| 4 — interface comum | APP15, APP16, APP18, APP19, APP20, APP23 e ajustes visuais | Perfil abre tela real; recursos indisponíveis não parecem prontos; carregamento/erro/offline consistentes; tema compartilhado; validação em tela pequena e desktop |
| 5 — distribuição e homologação | APP21, APP22, APP24, tipagem e dispositivos | Ambientes reais configurados, bundle e builds instaláveis verificados, TypeScript por projeto aprovado, testes em Android/iOS e navegador com perda de rede e troca de conta |

Esta auditoria não solicita apagar pendências offline, migrar banco ou reinstalar o app. Não há nova migração nesta entrega. Correções funcionais devem ser implementadas e testadas nos lotes acima após a definição do escopo da próxima etapa.
