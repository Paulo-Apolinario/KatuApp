# App Web do catador — simplificação de uso

## Escopo

Implementação autorizada em 05/11/2026. Apresentação específica para navegador; não foram gerados APKs, builds iOS ou alteradas configurações de distribuição nativa. Sem acesso à VPS ou alteração de produção.

## Tela inicial

`homecat.web.tsx` apresenta cinco ações, na ordem: Coleta extra; Solicitar coleta em PEV; Minhas rotas; Minha produção em equipe; Registrar coleta. Mantém perfil, notificações e saída. Não carrega a lista de coletas para desenhar a entrada nem bloqueia as ações com indicadores.

O mapa permanece na navegação inferior. Indicadores, histórico e impacto ambiental ficam na aba Dados; ali também ficam as contagens de pendentes/em andamento. Próximos atendimentos são consultados em Registrar coleta e Minhas rotas. A sincronização continua automática, com aviso de offline e pendências quando aplicáveis.

O conteúdo anterior de Dados foi extraído para `CollectorData`, mantendo a apresentação padrão nativa e recebendo a opção `simplified` somente na rota web. O formulário anterior da OC foi preservado em `ExtraOrderFormLegacy`, utilizado pela entrada nativa e pela cooperativa. Não foram reconstruídas as regras de rotas, produção de equipe ou PEVs.

## Coleta extra

Formulário específico para catador no navegador, em quatro etapas:

1. Registrar uma retirada realizada ou pedir uma coleta.
2. Escolher gerador cadastrado ou informar nome/endereço de uma origem sem cadastro.
3. Escolher materiais. Quantidade desconhecida pode ficar em branco.
4. Conferir dados, confirmar a guarda do material e enviar.

A cada etapa a rolagem recomeça no topo. Foto é opcional e fica recolhida. Motivo, observações, edição da data/horário, rota de contexto e solicitação anterior ficam em Mais detalhes. A categoria interna padrão permanece EXTRA_REQUEST para compatibilidade; não se exige justificativa escrita. O campo de motivo aceita vazio e observações curtas, sem a antiga exigência de cinco caracteres.

A origem permite busca sem diferenciar caixa/acentos. A seleção do gerador copia nome/razão social, telefone, CEP, rua, número, bairro, município, UF, endereço e coordenadas disponíveis. Informações ausentes não são inventadas. O schema atual de gerador não tem complemento separado; o endereço existente é preservado. O contexto segue restrito à cooperativa autenticada e mantém o limite anterior de 200 geradores. Não inclui CPF/documento, senha ou dados de acesso.

Alterar o local vale somente para essa OC. Trocar de origem limpa os vínculos, contato e coordenadas anteriores. Endereço manual pode ser informado diretamente, com detalhamento por CEP opcional; GPS/mapa permanecem disponíveis. Seleção provisória do mapa ou consulta em andamento bloqueia o avanço/envio até confirmação ou cancelamento.

Para uma coleta realizada, data/horário atuais são preenchidos e podem ser alterados; data futura continua inválida. Pedido futuro mantém o material na origem e não recebe data de coleta realizada. A data desejada é opcional; ao preenchê-la, o horário inicial sugerido é 08:00 e permanece editável/visível no resumo.

A situação de guarda é confirmada na etapa final. Explicação adicional é exigida para Outro local. Dizer que o material está na cooperativa não equivale ao recebimento físico.

## Quantidades e recebimento

A quantidade não informada permanece ausente na OC. Se a cooperativa aprovar uma coleta já realizada sem pesagem, o material operacional fica com quantidade técnica zero, `quantityPending: true`, quantidade originalmente informada nula e nota de conferência pendente. Não se persiste o valor temporário de validação de metadados como 1 kg nem se acrescenta peso fictício a totais.

A aprovação continua exclusiva da cooperativa. Recebimento, conferência de quantidades, triagem, destinação e estoque usam os fluxos existentes. A conferência posterior grava o peso real, atualiza totais e retira o sinalizador no JSON reconstruído pelo serviço existente. A conclusão operacional continua exigindo conferência. Uma quantidade explicitamente informada continua sendo validada como positiva e preservada.

Nenhuma migration ou mudança no Prisma foi necessária. Atualizar o backend antes de publicar o App Web, pois o backend anterior exige motivo e quantidades na OC realizada.

## Offline e rascunho

Reutiliza os serviços, repositórios e fila existentes. Voltar à lista aguarda a gravação do rascunho atual; erro de armazenamento mantém o formulário aberto. Durante o envio usa o mesmo UUID e a proteção contra submissão repetida. Sem internet, a OC fica na conta e no aparelho de origem para sincronização posterior. Não promete proteção contra limpeza dos dados locais pelo usuário/navegador.

## Validação executada

- TypeScript do App e do backend aprovados.
- ESLint dos arquivos de interface alterados aprovado, sem erros ou avisos após limpeza do import não utilizado.
- Build do backend aprovado.
- Export Expo Web e preparação da PWA aprovados.
- 12 testes com Fastify/Prisma e banco PGlite descartável: motivo/quantidade opcionais; validações adversas; guarda; preenchimento; limpeza de origem; JWT/RBAC/isolamento; persistência/idempotência; gerador estrangeiro; aprovação sem peso fictício; recebimento; pesagem posterior; preservação de quantidade conhecida.
- 11 testes de navegador no export real, com APIs interceptadas: entrada, aba Dados, etapas, busca/preenchimento, resumo, payload, troca de gerador, retomada de rascunho, envio offline/reconexão, pedido futuro/manual e desktop.
- 7 testes de regressão de fila/repositórios: persistência, reinício, conta, resposta perdida, falha de armazenamento, rascunho e recuperação. Atualizado somente o mock de plataforma/AsyncStorage/SecureStore que estava desatualizado no runner anterior.

Total: 30 cenários aprovados. As chamadas de produção foram bloqueadas/interceptadas nos testes de navegador. Não houve teste em celular físico ou PostgreSQL de produção. Permanecem avisos de ferramenta já existentes, como Browserslist e recursos CSS locais do Leaflet, sem bloquear o export.

## Reprodução local

Na raiz do KatuApp:

```bash
npm run check
npm --prefix server run check
npm --prefix server run build
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3339 npm run export:web
KATUA_VALIDATION_TOOLS=/caminho/ferramentas node server/tests/collector-web/run.mjs
KATUA_APP_DIST=/caminho/KatuApp/dist KATUA_CHROMIUM_PATH=/caminho/chromium KATUA_VALIDATION_TOOLS=/caminho/ferramentas node server/tests/collector-web/browser.mjs
node server/tests/extra-orders/offline.cjs
```

O diretório de ferramentas contém Playwright, PGlite e pglite-socket. O runner de integração recusa banco fora de `127.0.0.1:54329` e usa dados descartáveis. O navegador usa servidor local na porta 5185, fixtures e interceptação de APIs.

## Atualização posterior pelo responsável pela VPS

Backend primeiro, sem migrações novas:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Depois, App Web (não é o painel Vite):

```bash
cd /var/www/katua/app && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
```

A publicação depende de o domínio do App já servir esse `dist` pela configuração existente. Não alterar Nginx ou copiar para um destino presumido. Preservar a alteração local já conhecida em `server/src/server.ts` que vincula a API a 127.0.0.1.
