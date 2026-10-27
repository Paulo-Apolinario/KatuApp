# PEVs: solicitações pelo App e marcadores operacionais

Data local: 26/10/2026 — Fortaleza/CE. Repositórios: KatuApp e Katua_Web, branch main.

## Problema e resultado

Pessoas físicas e catadores não tinham um canal específico para informar a situação de PEVs cadastrados, enviar fotos e acompanhar a cooperativa responsável. Os mapas também precisavam distinguir melhor o aparelho do motorista, o catador, a sede e os pontos de coleta.

A atualização cria protocolos de atendimento vinculados ao PEV e à cooperativa proprietária do cadastro. Relatar um ponto cheio não cria pesagem nem estoque. A retirada usa o fluxo operacional existente e seus materiais entram somente na conclusão em campo, seguindo depois para recebimento, conferência, triagem e destinação.

## Entregue

- [x] Marcadores com símbolos de motorista/veículo, catador/pessoa, sede, PEV e coletas numeradas; seleção destacada, cores seguras e paridade dos componentes web/nativos.
- [x] A posição do aparelho continua dependendo de leitura válida do GPS. Coordenadas padrão do mapa não viram localização do usuário.
- [x] Marcador do aparelho preservado e priorizado quando coincide com um PEV; prevenção de duplicação por identidade do marcador, além das coordenadas.
- [x] Transições de mapa sem animações pendentes após desmontagem; lista de pontos e navegação externa preservadas.
- [x] PF: acesso em **Início → PEVs da cidade**, busca por nome/código/bairro/município, mapa, regras de materiais, solicitação e acompanhamento.
- [x] Catador: acesso em **Início → Solicitações de PEV**, relatos, fotos, pontos públicos e PEVs internos da própria cooperativa.
- [x] Catador pode abrir retirada na própria cooperativa sem vínculo obrigatório com rota, inclusive quando estiver em rota. Não pode assumir coleta de outra cooperativa nem substituir responsável de retirada já atribuída.
- [x] PEV público de outra cooperativa pode ser relatado pelo catador; a execução permanece restrita à equipe responsável.
- [x] Situações: cheio, transbordamento, dano, contaminação e outra situação, com descrição e até três fotos.
- [x] Confirmação do PEV e da cooperativa de destino antes do envio. O servidor resolve a cooperativa pelo cadastro; não aceita cooperativa forjada no payload.
- [x] Protocolo com endereço e nome históricos, autor, data, situação, fotos e complementações; fotos antes/depois podem ser anexadas com a descrição correspondente.
- [x] Painel: **Gestão de PEVs → Pedidos pelo App**, listagem paginada, filtro por situação, detalhe privado, fotos, respostas, encerramento com justificativa e delegação ao catador.
- [x] Pedidos também disponíveis na ficha individual do PEV, filtrados pelo ponto. No App da cooperativa há acesso a relatos e respostas.
- [x] Relatos abertos do mesmo PEV são associados à única retirada encaminhada pelo fluxo de PEVs; novos relatos reconhecem retirada já ativa.
- [x] Reenvio com mesmo protocolo não duplica pedido. Retirada cancelada pode ser reencaminhada, preservando o histórico. Coleta de outro responsável não é tomada automaticamente.
- [x] Respostas e encaminhamentos geram avisos persistentes no sino; os avisos abrem o protocolo correto. Solicitantes vinculados acompanham as notificações das etapas da coleta.
- [x] Retirada em campo também notifica os participantes da coleta; recebimento e demais transições mantêm o fluxo existente.
- [x] Rascunho do novo pedido por usuário no aparelho, incluindo fotos, com retomada e descarte. Envio exige conexão; UUID permanece estável nas tentativas.
- [x] Tela retorna ao início do protocolo após envio/troca de visão, evitando mostrar apenas os campos inferiores.
- [x] Documentação e evidências de validação nos dois repositórios.

## Publicação dos PEVs

O cadastro agora tem **PEV de acesso público · exibir no App e permitir relatos de pessoas físicas**. O padrão da migração é `false`, inclusive nos cadastros existentes: a atualização não publica automaticamente endereços internos.

Para disponibilizar um ponto de rua:

1. Editar o PEV no painel, conferir endereço e confirmar localização no mapa.
2. Usar modalidade PEV ou Ecoponto.
3. Habilitar a opção de acesso público e salvar.
4. Conferir no App PF pelo município, nome ou código.

PEVs sem coordenadas e pontos inativos não aparecem ao público. Manutenção continua visível para permitir relato da situação, mas a retirada exige ativação pela cooperativa. Contatos responsáveis, notas internas e fotos de relatos não entram na listagem pública. Pontos parceiros e sedes não são publicados por essa opção.

A cooperativa responsável é a vinculada ao PEV. Não há inferência de responsabilidade por CEP, proximidade ou limite territorial. Esta entrega trata PEVs já cadastrados.

## Atendimento e coleta

O pedido inicia em `OPEN` ou `ASSIGNED` se já houver retirada pendente/em andamento. A cooperativa pode responder, vincular retirada, encerrar atendimento (`RESOLVED`) ou encerrar sem retirada (`DISMISSED`), sempre com justificativa.

A situação da coleta vinculada aparece separadamente: pendente, em andamento, retirada em campo, recebida, triagem, concluída ou cancelada. Encerrar o relato não cancela a coleta, não altera sua quantidade e não zera estoque. Relato de dano não significa reparo automático da estrutura.

O catador abre a retirada pelo protocolo, usa **Coletar** para iniciar e registrar os materiais/quantidades, e pode voltar ao protocolo para complementar fotos. Recebimento e divergências de peso continuam sob conferência da cooperativa. Se outra equipe já estiver responsável pela retirada, a cooperativa deve coordenar o atendimento/reorganizar a coleta ou rota existente.

## Persistência, permissões e limites

Migração aditiva: `server/prisma/migrations/20261027000000_pev_app_requests/migration.sql`.

- `Bin.publicAccess` com padrão fechado.
- `PevRequest` e `PevRequestUpdate`, índices por cooperativa/solicitante/ponto/coleta e integridade referencial.
- Fotos guardadas no banco em JSON, vinculadas ao protocolo, sem URL pública em uploads. Detalhes e complementações exigem autenticação e escopo do solicitante ou da equipe responsável.
- Fotos JPEG/PNG/WEBP com validação de assinatura, até 200 KB cada e 600 KB por envio; App comprime antes do envio. Histórico paginado em cinco complementações; listagens não transferem as fotos.
- Até 20 novos pedidos por usuário em 24 horas; até 40 atualizações de usuários de campo em 24 horas e 100 registros de complementação por protocolo. Respostas da cooperativa não usam a quota diária de campo.
- Versão esperada, IDs de operação, verificação de reenvio e transações com bloqueio do PEV para encaminhar retiradas e tratar os relatos.
- Conta desativada perde acesso pela autenticação existente. Escopo e perfil são conferidos pelo servidor.
- O cadastro de materiais, lotes, estoque e destinação permanece no ciclo normal de coleta.

## Validação

**45 verificações passaram:** 24 cenários de integração da API, 11 cenários visuais/funcionais no navegador e 10 regressões de PEVs/geocodificação.

Resultados consolidados: `docs/validacao-pevs-solicitacoes-app-2026-10-26.json`.

- Integração com Fastify/Prisma e PostgreSQL embarcado PGlite descartável, aplicando o esquema anterior e a nova migração SQL.
- Navegador Chromium com App Expo exportado e painel Vite reais, consumindo a API e o banco locais. GPS simulado e tiles controlados; nenhuma emissão/ação na VPS.
- PF envia foto e confirmação; painel recebe, delega e responde; catador abre a coleta; protocolo e rascunho offline; marcadores do motorista/catador; largura de 320 px; publicação explícita.
- Regressões das coordenadas/CEP e identidade de PEVs.
- TypeScript, ESLint dos arquivos afetados, build da API, build Vite e exportação Expo web.

Os testes de banco usam uma conexão de validação. A proteção por bloqueio/versão está implementada, mas essa execução não equivale a ensaio de carga com várias conexões PostgreSQL. Não houve teste físico em Android/iOS nem verificação do sinal GPS real. O Vite mantém o aviso preexistente de bundle grande.

Testes reutilizáveis em `server/tests/pev-requests/integration.ts` e `browser.mjs`. O teste da API exige `KATUA_LOCAL_VALIDATION=1` e banco descartável em `127.0.0.1:54329`. O teste visual exige fixture gerada pelo teste local, painel local, Playwright/Chromium em ferramentas de validação e App previamente exportado. Não fornecer credenciais ou dados da VPS a esses testes.

## Aplicação na VPS pelo responsável

Não foi executado deploy na VPS. Atualizar os dois repositórios antes de gerar os arquivos estáticos.

API e banco, uma linha:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel, uma linha:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

App web, uma linha:

```bash
cd /var/www/katua/app && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Verificação, uma linha:

```bash
curl -fsS https://vps.katua.com.br/health && sudo systemctl is-active katua-api.service
```

Recarregar painel e App, habilitar um PEV público de teste e executar um pedido controlado. Preservar configurações locais existentes da VPS. O serviço continua no systemd, sem PM2.

## Backlog de evolução

- [ ] Ensaio em Android/iOS físicos, incluindo câmera, galeria, permissão e precisão de GPS.
- [ ] Fila automática de envio dos pedidos/complementações de PEVs. Nesta entrega o novo pedido tem rascunho local e envio manual após reconectar; o offline de coletas existente continua separado.
- [ ] Push com App fechado; nesta entrega os avisos são persistentes no sino e atualizados com App em uso.
- [ ] Políticas de retenção e armazenamento privado de objetos para maior volume de fotos.
- [ ] Agrupamento/expansão de pontos coincidentes em mapas densos, além da prioridade do aparelho e da lista de seleção existentes.
- [ ] Cadastro de sugestão de PEV ainda não registrado e gestão municipal de territórios/responsabilidades, com revisão antes da publicação.
- [ ] Priorização/SLA de atendimento e indicadores consolidados de relatos por PEV, sem interpretar relatos como medição automática de capacidade.
