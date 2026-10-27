# Mapa do motorista e acesso às solicitações de PEV

Data local: 26/10/2026 — Fortaleza/CE. Repositório: KatuApp, branch main.

## Problema e resultado

A tela do motorista misturava marcadores de todas as coletas carregadas, numerava-os pela lista geral e selecionava o primeiro registro da rota, mesmo atendido. Também ligava coordenadas em linha direta, podendo incluir a sede como parada sem considerar a partida configurada. Marcadores coincidentes e o destaque amarelo de seleção dificultavam a leitura. A imagem fornecida mostrava precisão de GPS de aproximadamente 275 metros, com apresentação ainda verde.

A atualização concentra a tela na rota escolhida, preserva a ordem planejada, destaca a próxima visita pendente, informa a precisão do aparelho e separa as coletas avulsas. O catador ganha acesso direto às solicitações de PEV no mapa, separado da abertura de O.C.

## Entregue

- [x] Visões **Rota selecionada**, **Coletas sem rota** e **Todas as rotas**. A seleção inicial prioriza rota em andamento, respeitando links recebidos do calendário e a rota escolhida ao recarregar.
- [x] Apenas visitas pendentes/em andamento aparecem inicialmente. Atendidas podem ser exibidas sob comando; canceladas e registros substituídos de roteiro ficam fora dos pontos operacionais.
- [x] Numeração usa `collectionOrder`, com ordem estável para registros sem posição explícita. Visitas já atendidas e cancelamentos comuns preservam posições; revisões substituídas do roteiro são excluídas. A numeração pode ter intervalos sem representar erro.
- [x] Próxima parada prioriza visita já em andamento, depois a primeira pendente na ordem do roteiro. Um ponto sem coordenadas não é pulado automaticamente.
- [x] Visão geral e coletas avulsas não recebem números de uma suposta rota otimizada. Na visão geral não é inventada uma próxima parada entre rotas distintas.
- [x] Partida e chegada usam os pontos configurados da rota, com símbolos próprios. A sede tem identificação e ação próprias; não é inserida como parada automaticamente.
- [x] Identificação do veículo atual, situação em português, data e veículo da rota, escolha de outra rota e acesso à execução do roteiro preservados.
- [x] Geradores, PEVs e endereços avulsos usam a origem/snapshot da visita. PEVs mantêm símbolo próprio e número da visita quando há roteiro.
- [x] Seleção em verde escuro, com remoção da bolinha amarela que poderia ser confundida com alerta. Legenda mostra os tipos presentes e identifica coleta em andamento em roxo.
- [x] Marcadores nas mesmas coordenadas são selecionáveis pela lista de pontos, inclusive motorista e sede. Informações selecionadas permanecem na lista, sem depender de popups descartados durante atualização do GPS.
- [x] Leitura com precisão reduzida ou desatualizada ganha fundo de aviso. Círculo representa o raio aproximado informado pelo aparelho; raio não entra na contagem de pontos nem simula posição exata.
- [x] GPS inicial participa do enquadramento, com espaço para o ícone. Atualizações seguintes do GPS não reiniciam o enquadramento nem arrastam o mapa de volta para uma visita selecionada no navegador.
- [x] Ações para enquadrar pontos, localizar aparelho, localizar sede e navegar para próxima parada/ponto selecionado.
- [x] Ligações retas artificiais retiradas do mapa do motorista. A navegação pelas ruas continua abrindo no serviço de mapas por destino. Não há nova promessa de navegação interna ou trajeto viário persistido.
- [x] Pontos sem localização permanecem na lista, com aviso e navegação bloqueada até correção. Coordenadas padrão do mapa não viram GPS do usuário.
- [x] Respostas antigas de carregamento/troca de rota são descartadas quando o contexto muda; dados de outra sessão são limpos. Cache e indicação de sincronização mantidos.
- [x] Componentes web e nativos compartilham símbolos, sequência e legenda. No nativo, movimentação inicial aguarda o mapa estar pronto e a lista é habilitada na tela do motorista.

## Onde o catador acessa as PEVs

1. **Início → Ações rápidas → Solicitações de PEV** (acesso já existente).
2. **Mapa → Solicitações de PEV** (acesso adicionado nesta atualização).

No mapa, o outro botão passa a identificar **Nova O.C. · coleta extra ou parada não programada**, preservando o fluxo de coleta extra para geradores/PFs e paradas fora do planejamento. O acesso às PEVs é separado desse botão.

## PEV sem rota programada: comportamento existente preservado

O catador seleciona um PEV cadastrado, descreve a situação e pode anexar fotos. O protocolo fica vinculado à cooperativa proprietária do PEV. Em ponto da própria cooperativa, **Abrir coleta deste PEV** pode gerar/abrir uma retirada sem `routeId`, inclusive quando o catador estiver em rota. A execução de coleta de outra cooperativa ou já atribuída a outro responsável é bloqueada pelo servidor.

A coleta usa a tela **Coletar** para início e registro dos materiais/quantidades. Fotos da situação antes/depois podem complementar o protocolo. Recebimento, conferência de peso, triagem, lotes e destinação seguem o fluxo da cooperativa. Relato sozinho não gera peso, lote ou estoque.

Este fluxo de PEV gera protocolo e coleta operacional, não uma O.C. extra. Sem conexão, o novo pedido de PEV permanece como rascunho local com envio manual após reconectar. Esta atualização não altera essas regras nem o offline de execução de coletas existente.

## Validação

**57 verificações passaram:** 9 testes de regras do mapa, 13 cenários visuais/funcionais do motorista e acesso às PEVs, 24 testes da API PEV e 11 regressões visuais do fluxo PEV.

Resultado consolidado em `docs/validacao-mapa-motorista-2026-10-26.json`.

- Testes de regras: isolamento entre rotas, sequência planejada, prioridade de coleta em andamento, visita sem coordenadas, cancelamentos, avulsas, snapshots e símbolos.
- Chromium com App Expo exportado real; API, GPS e tiles controlados. Cenários incluem precisão de 275 m, troca de rota, links do calendário, marcadores coincidentes, mapa estável após GPS e largura de 390 px.
- Regressões do fluxo PEV com API Fastify/Prisma e banco PGlite descartável, mais interface real de PF, painel e catador. GPS e tiles simulados.
- TypeScript, ESLint dos arquivos afetados e exportação Expo web.

Não houve acesso ou deploy na VPS. Os testes do navegador não comprovam precisão de GPS real nem funcionamento físico de Android/iOS; validação em aparelhos permanece no backlog. Mapas de fundo controlados nos testes não representam verificação de disponibilidade de provedores externos.

## Atualizar na VPS pelo responsável

Somente o App web precisa ser atualizado para esta entrega. Não há migração, alteração de API ou alteração no Katua_Web.

```bash
cd /var/www/katua/app && git pull --ff-only origin main && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Depois, recarregar o App com Ctrl + F5 ou fechar e reabrir a página no celular. Conferir **Mapa do motorista** e **Mapa do catador → Solicitações de PEV**. Builds nativos, quando usados, precisam ser gerados e distribuídos novamente para incluir os componentes nativos atualizados.

## Backlog

- [ ] Validar GPS, câmera, mapas, permissões e navegação em Android/iOS físicos.
- [ ] Expandir agrupamentos de marcadores visualmente em mapas muito densos; a lista já permite escolher pontos coincidentes.
- [ ] Persistir geometria viária e oferecer desenho de percurso com provedor definido, gestão de limites e política para o uso das coordenadas.
- [ ] Navegação guiada dentro do App, com tratamento de desvios, conectividade e limites do provedor, se aprovada como nova etapa.
