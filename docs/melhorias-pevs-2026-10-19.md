# Gestão de PEVs — melhorias e backlog

19/10/2026. Escopo autorizado: painel Katua_Web e API KatuApp, branch main. Implantação na VPS executada pelo responsável. Bases: Katua_Web b8570b1 e KatuApp 0b00b8c.

## Diagnóstico

O cadastro dependia de zonas sem endpoint correspondente e lia veículos por uma chave diferente da resposta da API. O envio de foto não tinha tratamento multipart no controlador. Não havia coordenadas, mapa, materiais múltiplos, horários estruturados nem vínculo entre PEV e coleta. A indicação de cheio se misturava com a situação operacional. Indicadores da lista não acompanhavam os filtros e erros podiam deixar informações antigas visíveis.

## Implementação entregue

| Tela/fluxo | Alterações |
| --- | --- |
| Cadastro e edição | Código, nome, modalidade, endereço estruturado, bairro, município/UF, regional, referência, responsável e contato. Fortaleza/CE como sugestão apenas em cadastros novos. CEP consultável pelo ViaCEP; não gera coordenadas automaticamente. |
| Localização | Leaflet/OpenStreetMap: clicar para posicionar, arrastar marcador, informar latitude/longitude ou limpar localização. Coordenadas persistidas e recuperadas após recarga. Centro inicial em Fortaleza não representa ponto cadastrado. |
| Materiais e atendimento | Múltiplos materiais, restrições, dias e intervalos de atendimento, fechamento e exceções. Não presume que todos os pontos tenham o mesmo horário. |
| Capacidade | Valor com unidade kg, litros ou m³, separado das quantidades efetivamente coletadas. Nenhuma conversão automática de volume para peso. |
| Veículo e fotografia | Lista de veículos corrigida; vínculo opcional. Foto JPEG/PNG/WebP até 5 MB, envio separado após criação, validação de conteúdo e nome aleatório. Falha no envio permite repetir sem criar outro PEV. |
| Listagem | Busca sem distinção de acentos; filtros combinados por situação, município, bairro, material, necessidade de retirada e ausência de coordenadas; cartões coerentes; paginação local; CSV do conjunto filtrado. |
| Mapa da listagem | Marcadores dos pontos salvos com coordenadas válidas, respeitando filtros. Pontos sem coordenadas continuam acessíveis na lista e podem ser corrigidos. |
| Ficha do PEV | Cadastro completo, foto, mapa, capacidade, atendimento, materiais, pendência de retirada, vistorias, ocorrências, coletas vinculadas e histórico. |
| Vistorias e ocorrências | Registro de condição, observação, necessidade de retirada, autor e data; resolução de ocorrência registrada. Histórico de alterações e de ações operacionais. |
| Solicitar retirada | Cria coleta real PENDING, com catador e rota opcional. Valida cooperativa, situação do ponto e vínculos operacionais; bloqueia outra retirada pendente/em andamento para o mesmo PEV. Não cria peso ou material fictício. |
| Coleta até estoque | Origem PEV disponível em coletas/entradas/destinações. Finalização em campo atualiza a necessidade de retirada e histórico; recebimento, destinação e estoque seguem o fluxo existente. Última retirada registrada vem da coleta real. |
| Inativação | Preserva ponto, coletas e histórico; bloqueia novas solicitações enquanto inativo/em manutenção. |
| Confiabilidade | Validação no servidor, isolamento por cooperativa e perfil, mensagens persistentes com tentativa novamente, indicação de atualização e limpeza de dados antigos em falhas. |

## API e banco

Migração aditiva: `server/prisma/migrations/20261019230000_pev_operations/migration.sql`. Acrescenta campos ao Bin, Collection.binId e tabela BinEvent. Preserva localização livre, capacidade e data legadas. Converte capacidadeKg para capacidade em KG e FULL para ACTIVE com needsPickup=true, separando situação de necessidade operacional. Não deduz coordenadas, bairro ou cidade a partir de texto legado.

Rotas autenticadas: CRUD compatível em `/bins`, ficha `/:id`, histórico `/:id/events`, resolução `/:id/events/:eventId/resolve`, GET/POST `/:id/withdrawals`, PUT/DELETE `/:id/photo`. DELETE do ponto significa inativação. Eventos e retiradas têm paginação no servidor; lista geral ainda é carregada integralmente.

Retiradas bloqueiam a linha do PEV na transação para serializar verificações no mesmo ponto. Isso não representa garantia global de exclusividade de veículo/catador entre todas as operações do sistema.

Fotos ficam em `server/uploads/bins`, expostas pelo mecanismo estático existente. Substituir/remover desvincula a imagem; arquivos antigos são preservados até política de limpeza. Não são versionados no Git.

## Validação executada

- TypeScript da API e builds da API e painel passaram. ESLint dos arquivos de implementação alterados passou. Vite mantém aviso de bundle grande.
- 26 testes de unidade/contrato/regressão passaram, incluindo coordenadas ausentes/zero, limpeza de campos, unidades, filtros e origem PEV.
- Nove cenários integrados com Chromium, API real Fastify/Prisma e banco PGlite descartável: migração incremental sobre schema anterior com PEV legado; cadastro via clique no mapa com foto/horários/materiais; marcadores filtrados e CSV; edição e limpeza de localização/vínculos/foto; vistoria e resolução; retirada com duplicidade rejeitada; coleta real até entrada e estoque; isolamento de cooperativas/perfil e entradas inválidas; inativação, celular de 430 px, offline e recuperação. Sem erro JavaScript na execução validada.
- Capturas desktop e celular revisadas. As imagens de mapa-base externas foram bloqueadas no teste: marcadores e interação foram verificados com aviso de indisponibilidade; carregamento cartográfico real deve ser conferido na VPS. ViaCEP depende de serviço externo. Aplicativo nativo não foi validado visualmente nesta entrega.
- O teste integrado usa dados fictícios e não acessa banco, arquivos ou credenciais da VPS. Não substitui homologação com PostgreSQL nativo, concorrência real e dados de produção.

Reprodução: em `frontend`, executar `node --test tests/*.test.mjs` e `npm run build`; em `server`, `npm run check` e `npm run build`. Integração: instalar PGlite, pglite-socket e @sparticuz/chromium em diretório separado; definir KATUA_VALIDATION_TOOLS, KATUA_APP_DIR (checkout KatuApp) e KATUA_PLAYWRIGHT_MODULE; executar `node tests/pevs-browser.mjs` em frontend. Exige portas locais livres 54329, 3339 e 5179. O baseline é fixado no commit 0b00b8c para continuar reprodutível após publicação.

## Atualização na VPS — API antes do painel

1. Fazer backup do PostgreSQL, `.env` e uploads; conferir alterações locais com `git status`, preservando especialmente qualquer ajuste de `server/src/server.ts` e seus backups. Não usar reset/clean para sobrescrevê-los.
2. Atualizar KatuApp/main e, no diretório `server`, instalar dependências com `npm ci`, executar `npx prisma generate` e verificar `npx prisma migrate status`.
3. Se houver histórico divergente ou migração antiga com falha, regularizar conforme estado real do banco antes de continuar. Não usar `db push`, reset nem `migrate resolve` indiscriminadamente para contornar o histórico.
4. Com histórico regularizado e backup confirmado, executar `npx prisma migrate deploy`, depois `npm run check` e `npm run build`. A nova API exige a migração antes de iniciar. Conferir que o usuário do serviço consegue gravar `server/uploads/bins` e que backups incluem essa pasta.
5. Reiniciar o serviço existente `sudo systemctl restart katua-api.service` e conferir `sudo systemctl is-active katua-api.service` e logs do serviço. Não usa PM2.
6. Somente depois atualizar Katua_Web/main, executar `npm ci` e `npm run build` no diretório `frontend` do repositório, mantendo a configuração existente de VITE_API_BASE_URL e publicação do dist.
7. Conferir no navegador: listagem legada, cadastro de teste, clique/arraste/salvamento do marcador, recarga, mapa geral, foto, vistoria e retirada. Conferir mapa-base e uploads pelo endereço público. Coordenadas dos pontos antigos devem ser cadastradas individualmente.

Não foi executada implantação, migração ou reinicialização na VPS nesta entrega.

## Backlog

| Item | Prioridade | Estado / critério |
| --- | --- | --- |
| Cadastro, mapa, filtros e ficha | P1 | Implementado e validado localmente; conferir no ambiente publicado |
| Vistorias, ocorrências e retirada vinculada | P1 | Implementado e validado no fluxo real da API local |
| Migração e implantação | P1 | Responsável atualiza VPS; pré-requisito para usar o painel novo |
| Completar dados legados | P1 | Endereços, coordenadas, horários e responsáveis reais; sem preenchimento presumido |
| Homologação PostgreSQL e concorrência | P1 | Validar solicitações simultâneas e disponibilidade compartilhada com operações externas a PEVs |
| Listagem em grande escala | P2 | Paginação/filtros/agregações no servidor e agrupamento de marcadores conforme volume real |
| Fotos em produção | P2 | Conferir limites do proxy, permissão de escrita e persistência; definir retenção/limpeza de arquivos desvinculados |
| Indicadores de desempenho | P2 | Evoluir periodicidade, tempo até retirada e produtividade com histórico suficiente; não inventar ocupação percentual |
| Mapa público e integração municipal | P3 | Avaliar publicação consentida de pontos e atualização por fonte oficial; nenhuma importação automática nesta entrega |
| Aplicativo nativo | P2 | Homologar visualmente origem PEV nas telas do catador, mantendo o contrato de coleta existente |

## Referências consultadas

Modelagem adaptada à operação da cooperativa em Fortaleza; não atribui vínculo oficial da plataforma com prefeituras.

- [Mapa oficial de Ecopontos de Fortaleza](https://mapas.fortaleza.ce.gov.br/mapa/776/ecopontos): localização, situação e informações de atendimento.
- [Re-ciclo Fortaleza](https://reciclo.fortaleza.ce.gov.br/sobre-o-re-ciclo): articulação entre coleta seletiva, pontos e associações.
- [Prefeitura de Fortaleza — horários dos Ecopontos](https://fortaleza.ce.gov.br/noticias/capital-limpa-e-ordenada-23-ecopontos-ampliam-horario-e-passam-a-funcionar-ate-19h-todos-os-dias): motivação para horários próprios de cada unidade.
- [Prefeitura de São Paulo — PEVs](https://prefeitura.sp.gov.br/subprefeituras/w/secretaria_executiva_de_limpeza_urbana/350659): materiais e capacidade volumétrica.
- [Curitiba — Ecocidadão](https://www.curitiba.pr.gov.br/servicos/ecocidadao-separacao-materiais-reutilizaveis/lotes-projeto-cadastramento/398): contexto de operação de associações/cooperativas.
- [Leaflet 1.9.4](https://leafletjs.com/reference.html): marcadores, eventos, interação e atribuição do mapa.
