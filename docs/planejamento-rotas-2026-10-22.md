# Planejamento de rotas — 22/10/2026

## Objetivo

Profissionalizar cadastro e edição de rotas, integrando seleção de coletas, sequência persistente de visitas, mapa da sede/geradores/PEVs, recursos e revisão antes de salvar. Trabalho autorizado pelo responsável; implantação na VPS continua com ele.

## Entregue

- Cadastro e edição passam a compartilhar o mesmo planejamento, com identificação, data por calendário, orientações, veículo/motorista, sequência de coletas e paradas adicionais em texto. Nome com 2 a 120 caracteres, observações até 3.000 caracteres.
- Seleção de coletas pendentes/em andamento, livres de outra rota. Busca por origem/endereço/código e filtros por município, bairro, gerador/PEV e data efetivamente programada no agendamento. Selecionar coleta não cria outra coleta.
- Itens apresentam origem, situação, código curto, endereço, materiais, quantidades em unidades próprias e catador quando existente. Quantidade ausente continua ausente; não vira peso zero. Resumo não soma litros ou unidades como kg nem promete ocupação do veículo.
- Sequência com controles acessíveis de subir/descer/remover. Cada coleta mantém sua identificação, inclusive coletas de um mesmo endereço. Até 200 vínculos por requisição do planejamento, sem repetição de IDs. Lista de disponíveis paginada em oito itens na interface.
- Mapa Leaflet/OpenStreetMap com sede e pinos numerados. Seleção da lista centraliza o pino e clique no marcador seleciona a coleta. Linha pontilhada representa só a sequência visual e é omitida se uma coleta selecionada não possuir coordenadas. Não há roteamento por ruas, previsão de duração ou otimização automática.
- Coleta sem coordenadas permanece no planejamento, com acesso ao cadastro de origem em outra aba. Sede ausente recebe aviso e acesso às configurações. Mapa-base indisponível recebe aviso sem esconder os pontos/lista.
- Placa, modelo, situação e capacidade cadastrada do veículo. Sugestão automática do motorista vinculado ao veículo quando ativo; mensagem de incompatibilidade quando outro motorista é escolhido.
- Veículo inativo/manutenção e motorista inativo bloqueados na seleção e revalidados pela API. Motorista em rota continua visível com sua situação. Aviso de possível conflito se motorista ou veículo tiver outra rota agendada/em andamento na mesma data. Sem janela de horário, esse aviso não afirma sobreposição exata.
- Resumo com situação, programação, motorista, placa, coletas, paradas em texto, quantidades, ausências de medição e coordenadas. Formulário preservado no erro; carregamento de opções com falha oferece recuperação e não libera salvamento incompleto por falha de consulta.
- Criação somente como Agendada; rota sem data/equipe/coletas pode ser salva para planejar depois. Não foi criado um novo status de rascunho.
- Ações de iniciar/concluir/cancelar separadas do formulário de edição. Alterações não salvas bloqueiam essas ações. Início exige data, motorista, veículo ativo e coleta pendente/em andamento. Conclusão mantém a regra existente de ao menos uma coleta finalizada em campo e nenhuma pendente/em andamento; não aguarda triagem. Cancelamento mantém a regra anterior de ausência de coletas operacionais ativas.
- Rota concluída/cancelada fica somente leitura para planejamento e histórico. Não se permite reabrir uma rota encerrada por PATCH.

## API e persistência

`POST /routes` e `PATCH /routes/:id` aceitam `collectionIds` opcionais na ordem desejada. No PATCH, a lista representa todos os vínculos desejados; omitir o campo preserva os vínculos. Uma lista vazia remove somente quando isso não apaga histórico de coletas finalizadas/canceladas.

Criação e edição usam transação serializável para gravar a rota, reivindicar/liberar coletas e persistir a ordem. A API verifica cooperativa, disponibilidade, situação da coleta e compatibilidade dos recursos; disputa de uma mesma coleta não pode criar dois vínculos. A atualização de motorista/veículo se propaga apenas a coletas pendentes/em andamento. Coletas já finalizadas mantêm os responsáveis históricos.

Rotas passam a ter `collectionOrder String[]`, com padrão vazio. `GET /routes/:id` devolve `collections` na ordem persistida; rotas antigas sem ordem explícita usam criação/ID como ordenação determinística até o primeiro salvamento. As paradas antigas em `stops String[]` continuam intactas como paradas adicionais em texto, separadas dos vínculos reais.

Os endpoints anteriores de adicionar/remover coleta continuam funcionando e mantêm `collectionOrder` sincronizado. API de disponíveis/detalhe inclui origem PEV e materiais com unidade para a nova interface. Não é necessário instalar dependência de produção nova.

## Migração obrigatória

`20261022120000_route_collection_order` adiciona somente uma coluna `TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]` em `Route`. Não apaga nem substitui coletas, histórico ou paradas em texto. Aplicar antes de reiniciar a nova API; caso contrário, consultas Prisma de rotas falharão por coluna ausente.

## Validação

- API: geração Prisma, `npm run check` e build de produção aprovados.
- Painel: lint dos arquivos afetados e build Vite aprovados; permanece aviso anterior de tamanho de bundle.
- Sete cenários Chromium com API Fastify/Prisma real e banco PGlite descartável: validações/rollback/autorização; concorrência; criação com gerador e PEV/unidades/agenda; edição/ordem/remoção/histórico; operação e endpoints antigos; recuperação de falhas/preservação do formulário; layout móvel.
- Baseline de teste sem a nova coluna e migração incremental aplicada antes de inicializar a API. Conferida persistência via nova consulta HTTP e recarga da edição, incluindo ordem e paradas em texto.
- Quatro testes existentes de contratos de edição e resumo de equipe aprovados.
- Capturas de desktop/celular inspecionadas. Tiles externos são bloqueados para validar o aviso e a consulta por lista/pinos sem mapa-base. Sem chamadas ao SINIR ou alterações no banco da VPS.
- Resultados: [validacao-planejamento-rotas-2026-10-22.json](validacao-planejamento-rotas-2026-10-22.json).

Testes: `frontend/tests/route-planning-browser.mjs` e `server/tests/route-planning/local-server.ts`. Fixture recusa banco fora de `127.0.0.1:54329`. Ferramentas externas locais são as mesmas dos testes anteriores de painel.

## Implantação

Atualizar `main` dos dois repositórios, preservando `.env`, `.env.production`, uploads e ajustes locais. Não usar PM2 nem resetar arquivos da VPS.

1. Em `/var/www/katua/app`, atualizar GitHub.
2. Em `/var/www/katua/app/server`: `npm ci --include=dev`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run check` e `npm run build`.
3. Reiniciar `katua-api.service` e confirmar `active`.
4. Atualizar Katua_Web em `/var/www/katua/frontend`, instalar dependências e compilar em `/var/www/katua/frontend/frontend`.
5. Conferir Nginx e abrir o painel com recarga sem cache.
6. Validar uma rota com coletas reais: selecionar, ordenar, salvar e reabrir; conferir disponibilidade da equipe e avisos de coordenadas.

Não precisa export Expo nesta entrega: telas Expo não foram redesenhadas. O detalhe de rota da API agora devolve as coletas na ordem persistida, mas telas do app que aplicam outra ordenação local não foram alteradas.

## Limites e backlog

- [x] Planejamento unificado de cadastro/edição, seleção de coletas e mapa.
- [x] Ordem persistente, transações, validação de equipe e proteção do histórico.
- [x] Resumo por unidade, falhas explícitas e leitura de rotas encerradas.
- [x] Migração incremental, testes e documentação.
- [ ] Roteamento rodoviário/otimização automática com integração específica.
- [ ] Horário/janela operacional e cálculo preciso de conflitos de equipe.
- [ ] Recorrência e modelos reutilizáveis de rota.
- [ ] Conferência da sequência em todas as telas Expo que reordenam dados localmente.
- [ ] Requisições com chave de idempotência para recuperação automática de confirmação desconhecida de rede. Nesta entrega, duplo envio simultâneo é bloqueado na interface; falha de rede orienta conferir a lista antes de reenviar.

Não há criação de coletas novas a partir de simples seleção de gerador/PEV sem operação existente. Solicitações devem seguir o fluxo de aprovação/delegação que já existe. Limites de planejamento são explícitos, sem truncamento silencioso de vínculos antigos.
