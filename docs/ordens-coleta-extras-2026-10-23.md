# O.C. — Ordens de coleta extras — 23/10/2026

## Objetivo

Registrar solicitações ou coletas realizadas fora da programação da cooperativa, incluindo fim de semana, dia diferente, atendimento adicional e parada em ponto não planejado durante uma rota. Implementação autorizada por Paulo, incluindo explicitamente a parada extra durante o roteiro.

A O.C. é um registro preliminar ligado ao catador e à cooperativa. Não é uma entrada automática em estoque nem um comprovante de destinação. Uma coleta pode ter sido realizada antes da análise administrativa; os momentos de realização, registro na API, recebimento e decisão são preservados separadamente.

## Onde acessar

- Catador: início → **Ordens de coleta extras**. O mapa do catador também oferece **Registrar parada extra / O.C.**.
- App da cooperativa: início → **Analisar ordens de coleta extras**.
- Painel: **Coleta de Resíduo → Ordens de coleta extras**, rota `/extra-collection-orders`.
- Após aceitar, abrir a coleta vinculada para seguir com recebimento, triagem, destinações e encerramento pelas telas existentes.

## Backlog entregue

| ID | Entrega | Critério |
| --- | --- | --- |
| OC01 | Nova ordem para solicitação ainda não realizada ou coleta já realizada | As situações são distintas e a aprovação não simula execução de campo. |
| OC02 | Motivos independentes da situação | Ponto fora do planejamento, solicitação extra, fora da programação, fim de semana ou outro motivo. |
| OC03 | Rota de contexto | Parada extra exige referência de rota da equipe. Uma rota encerrada pode ser citada; sua situação e sequência planejada não são alteradas. |
| OC04 | Origem PF/gerador | Nome, contato opcional, endereço, vínculo opcional com gerador e solicitação existente, coordenadas opcionais e informação de precisão quando há GPS. |
| OC05 | Materiais e unidades | Catálogo da cooperativa ou proposta de material; quantidade efetiva obrigatória para coleta realizada, estimativa opcional para solicitação futura. Sem conversão fictícia de L/un/m³ para kg. |
| OC06 | Evidências fotográficas | Até três fotos, com compressão no app para até 200 KB por foto. Formatos raster validados na API e limite conjunto de 600 KB. Fotos ficam nos dados privados da ordem, acessíveis pelo escopo autenticado. |
| OC07 | Rascunho local | Nova ordem preserva os campos e as fotos no aparelho. Rascunho não é enviado automaticamente. Complementação é enviada explicitamente; voltar antes de enviá-la não confirma a alteração. |
| OC08 | Fila offline | UUID estável, gravação antes de envio, retomada após reinício e separação por conta. Resposta perdida não cria outra ordem. |
| OC09 | Correção de envio com erro | Somente após consultar a API e conferir o vínculo. Ordem já existente não é descartada; correção local preserva o UUID e não apaga outras pendências. |
| OC10 | Fila de análise no painel e app | Buscar, consultar status, analisar detalhes, fotos, materiais, contexto e histórico. Painel com paginação; app com busca nos registros carregados e carregamento adicional. |
| OC11 | Complementação | Cooperativa solicita informações; catador reenvia uma nova revisão. Histórico anterior preservado e revisão antiga rejeitada. |
| OC12 | Aceitação transacional | Gera uma única coleta vinculada e reaproveita normalização, entradas de materiais e indicadores existentes. Reenvio reconhecido por operação e decisões concorrentes são serializadas. |
| OC13 | Recebimento separado da aprovação | Cooperativa pode registrar chegada física antes de aceitar. Isso não cria estoque nem aprova a O.C. automaticamente. |
| OC14 | Integração com recebimento normal | Se o recebimento for feito nos detalhes da coleta vinculada, a O.C. recebe o evento correspondente e atualiza a guarda. |
| OC15 | Recusa com encaminhamento | Exige justificativa, localização/guarda e encaminhamento dado ao material. Não apaga o relato nem transforma a recusa em desaparecimento físico do material. |
| OC16 | Permissões e rastreabilidade | Catador acessa suas ordens na cooperativa vinculada; só a cooperativa responsável analisa/recebe. Eventos preservam autor, data, decisão e dados de cada versão. |
| OC17 | Visão operacional | Endereço confirmado da O.C. é preservado na coleta gerada. Linha do tempo distingue registro por O.C. de delegação prévia e não inventa horário de início ausente. |

## Situações e transições

| Situação | Responsável e efeito |
| --- | --- |
| Rascunho no aparelho | Catador ainda não enviou. Não está na cooperativa. |
| Aguardando envio / envio com erro | Dados estão na fila local. Não afirmar que a cooperativa recebeu. |
| Aguardando análise | Registro confirmado pela API, visível à cooperativa. |
| Complementação solicitada | Cooperativa descreve o que falta; nova versão do catador retorna à análise. |
| Aceita | Uma coleta vinculada é criada. A O.C. continua disponível para consulta. |
| Recusada | Relato e encaminhamento continuam registrados, sem criar coleta aprovada ou lote. |

O recebimento é um marco independente dessas situações. Informar “Na cooperativa” no formulário do catador é uma declaração de guarda; somente a confirmação da cooperativa registra `receivedAt`.

### Exemplo de fim de semana

1. Catador retira material no sábado e registra data/hora reais, origem, materiais, guarda e fotos.
2. Sem rede, a O.C. permanece local. Na reconexão, chega à cooperativa com o mesmo protocolo.
3. A cooperativa pode confirmar a chegada física com seu horário real, inclusive antes da análise.
4. Ao aceitar posteriormente, a coleta nasce em **COLLECTED** ou **RECEIVED**, conforme o recebimento já confirmado; não é necessário simular início e conclusão do sábado na segunda-feira.
5. Os materiais passam pelo fluxo normal de conferência/destinação. Lotes só surgem quando há destinação para estoque.

### Parada extra durante uma rota

A O.C. guarda `contextRouteId` e nome de referência da rota. Essa relação informa onde ocorreu o atendimento, sem adicionar silenciosamente o ponto ao planejamento original. A coleta aprovada não herda automaticamente `routeId`, motorista ou veículo da rota de contexto. Recursos podem ser definidos pela cooperativa; a coleta futura pode depois entrar no planejamento normal.

O vínculo com solicitação existente é conferido na aprovação. Se a solicitação já foi atendida, a aprovação é bloqueada para não gerar uma segunda coleta; a ordem relatada permanece disponível para análise/complementação. O protocolo de registro não é uma autorização para duplicar a solicitação original.

## Dados e API

Nova migração: `20261023120000_extra_collection_orders`.

Cria `ExtraCollectionOrder` e `ExtraCollectionOrderEvent`, índices, vínculos de histórico e unicidade da coleta aprovada. É aditiva e não modifica destinações/lotes anteriores. As fotos comprimidas ficam em JSON na ordem/eventos. A listagem não transporta fotos e revisões completas; detalhes são consultados separadamente.

Endpoints autenticados:

- `GET /extra-collection-orders/context`: cadastros e vínculos de apoio dentro do escopo permitido.
- `GET /extra-collection-orders`: lista paginada, com filtros de status e protocolo/catador/rota.
- `GET /extra-collection-orders/:id`: detalhes e eventos.
- `POST /extra-collection-orders`: abertura pelo catador, com UUID estável e cooperativa de destino.
- `POST /extra-collection-orders/:id/revise`: complementação com operação e revisão esperada.
- `POST /extra-collection-orders/:id/review`: aceitar, pedir complementação ou recusar.
- `POST /extra-collection-orders/:id/receive`: recebimento físico pela cooperativa.

A criação e as decisões são transacionais. A mesma solicitação original não pode gerar duas coletas por aprovações concorrentes de O.C.s diferentes. Datas de campo e recebimento não podem estar no futuro; recebimento não pode preceder a realização registrada. Não há rota para apagar o histórico.

## Offline e distribuição

Foi acrescentada a tabela local `extra_orders_local`, sem apagar os dados existentes. A fila usa `EXTRA_ORDER_WRITE` e fica associada à conta. Inicialização do app cria a tabela adicional no SQLite. No web utiliza o adaptador persistente do navegador.

É necessário já ter sessão e vínculo de cooperativa conhecidos no aparelho. Cadastros e rotas previamente carregados podem ser reutilizados; sem catálogo disponível, o catador pode descrever material proposto. Dados não carregados não são inventados. Capacidade de armazenamento depende do aparelho/navegador; falha de gravação não é confirmada como sucesso.

As dependências `expo-image-picker`, `expo-image-manipulator` e `expo-crypto` usam as versões compatíveis indicadas pelo SDK Expo instalado. Permissões de câmera/fotos são explícitas e em português. Não foi habilitada gravação de áudio ou rastreamento em segundo plano.

## Atualização da VPS

Paulo executa o deploy. Codex não acessou a VPS.

1. Atualizar `main` de KatuApp e Katua_Web, preservando ambientes e uploads.
2. Em `/var/www/katua/app/server`: `npm ci --include=dev`, gerar Prisma Client, aplicar `prisma migrate deploy`, verificar e compilar.
3. Reiniciar `katua-api.service` e conferir `/health` e logs.
4. Em `/var/www/katua/frontend/frontend`: instalar dependências e compilar o painel.
5. Na raiz `/var/www/katua/app`: instalar dependências e exportar Expo web com `EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br`; publicar no diretório já configurado para `app.katua.com.br`.
6. Distribuir compilação nativa atualizada para os celulares. As novas dependências e permissões não são entregues somente reiniciando a API ou exportando o painel.
7. Validar contas de teste: nova O.C., perda de rede, envio, análise, recebimento, triagem, destinação e encerramento.

Aplicar a migração antes de iniciar a API nova, pois consultas de coleta passam a reconhecer a relação com O.C. Não utilizar `migrate resolve --applied` para pular a execução desta migração.

## Validação e backlog de homologação

Resultados em `docs/validacao-ordens-coleta-extras-2026-10-23.json`. **68 verificações aprovadas:** 41 cenários de API/navegador, 9 regressões de contratos, 11 da fila anterior e 7 da fila de O.C. TypeScript do app/API e ESLint verificado sem erros/avisos; builds API/Vite e exportações Expo web/JavaScript Android concluídos. Vite mantém aviso de tamanho dos chunks.

- Regressões de contratos e da fila anterior.
- Sete cenários da fila de O.C.: preservação de protocolo/foto/unidade/contexto, reinício, troca de conta, resposta perdida, falha de armazenamento, rascunho e correção isolada de envio.
- API real Fastify/Prisma com PostgreSQL descartável via PGlite, incluindo execução da nova migração.
- Aprovação concorrente/reenvio, isolamento por perfil/cooperativa, recebimento anterior à aprovação, integração com recebimento normal, rota já encerrada, revisões, recusa, solicitação futura, proteção contra duplicidade da solicitação e validações de evidência/data.
- Navegador: painel recebe e aceita uma O.C.; app anexa foto, registra parada extra offline e envia após reconexão. GPS do navegador é simulado e chamadas externas são bloqueadas.
- TypeScript, ESLint, builds e exportações conforme resultados consolidados.

Pendências de homologação: instalar e testar em celulares Android/iOS físicos; conferir câmera, galeria, permissões, SQLite, falta real de rede e espaço disponível; validar Nginx/publicação da VPS e volumes maiores de ordens/fotos. O bundle Android exportado não equivale a um APK/AAB instalado. Não foram usados banco, credenciais ou dados reais da cooperativa.
