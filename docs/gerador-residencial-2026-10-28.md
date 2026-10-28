# Gerador residencial — atualização de 28/10/2026

## Entrega autorizada

O perfil apresentado como Pessoa Física passa a **Gerador residencial**. O papel interno continua `PF`: contas, histórico e permissões são preservados. Nenhuma tela do perfil cooperativa no App foi alterada. O painel recebe somente este acompanhamento; as travas de concorrência na API protegem a operação existente.

## Telas e comportamento

| Área | Atualização |
| --- | --- |
| Escolha, login, cadastro e recuperação | Nome Gerador residencial nos textos destinados ao morador; parâmetros antigos de autenticação continuam válidos |
| Início | Pedidos aguardando análise, atendimentos, massa efetivamente recebida, solicitações em destaque e última coleta recebida; acesso direto a PEVs, participação e planejamento |
| Solicitar | Cinco etapas: cooperativa, retirada, materiais, preferência e revisão; busca por nome/município; endereço principal e locais salvos; localização opcional; categorias, busca e resumo de materiais |
| Data e hora | Digitação e colagem de `28102026` → `28/10/2026` e `1430` → `14:30`; validação de calendário e horário futuro; indicação de horário de Fortaleza |
| Quantidades | Estimativa opcional com orientação “Não sei a quantidade”; unidade do catálogo preservada; dicas para separar os materiais selecionados |
| Envio | Conteúdo e identificador persistidos antes do primeiro envio. Resposta perdida permite retomar o mesmo pedido após recarregar, sem gerar outro. Erros definitivos de validação/recurso liberam a correção; falha de rede preserva a tentativa |
| Minhas coletas | Histórico paginado com cards, protocolo, cooperativa, preferência ou data programada e acesso aos detalhes; busca identifica que opera sobre páginas carregadas |
| Acompanhamento | Endereço, preferência e programação separados; linha do tempo usa eventos registrados; materiais previstos e recebidos separados; contatos disponíveis da cooperativa |
| Cancelamento | Confirmação explícita do morador; permitido somente em `REQUESTED` e antes de qualquer coleta vinculada. Depois da programação/delegação, a alteração deve ser tratada com a cooperativa |
| Repetir pedido | Preenche cooperativa, endereço, coordenadas e materiais, sem enviar automaticamente; exige nova data. Material fora do catálogo atual é preservado como proposta, com unidade, para análise |
| Perfil | CPF/endereço lidos de `personProfile`; nome, telefone e endereço principal editáveis; até dez locais salvos na conta, reutilizáveis em outro dispositivo. CPF/e-mail não são alterados neste formulário |
| Participação | Massa recebida acumulada, quantidade de coletas recebidas e gráfico dos últimos seis meses. Solicitações e materiais apenas coletados em campo não somam peso recebido. Sem pontuação artificial ou classificação pública |
| Planejamento | Mês/ano com máscara e navegação anterior/atual/seguinte; estimativas em kg; números brasileiros, sem aceitar valores negativos ou texto; pequenas quantidades mantêm até três casas decimais. Não cria estoque, coleta ou participação |
| PEVs | Pedidos do próprio usuário em destaque; busca por bairro/nome/município; atalho de trajeto quando houver coordenadas. Apresentação residencial aplicada somente a PF; comportamento da cooperativa preservado |
| Chat, benefícios e NFC | Permanecem informativos e fora dos atalhos principais, com apresentação residencial consistente |
| Navegação web | Rotas residenciais exclusivas evitam colisão com telas homônimas de outros perfis ao recarregar. Entradas antigas do grupo continuam disponíveis e os novos atalhos usam os endereços exclusivos |

A barra principal oferece Início, Solicitar, Coletas, Evolução e Perfil. Não há solicitação automática de GPS na página inicial. O morador escolhe usar sua posição na etapa de retirada.

## Integridade e API

- Novos recursos `/residential/*` exigem uma conta PF ativa e restringem leitura/escrita ao titular autenticado.
- Totais são agregados no servidor. O App não baixa o histórico inteiro para calcular participação ou perfil.
- A API valida endereço e preferência futura na solicitação residencial. O morador não pode definir `scheduledDate` como confirmação.
- `requestOperationId` único, hash do conteúdo e trava transacional do titular tornam o reenvio idempotente. O catálogo de materiais propostos também não duplica na retomada.
- Cancelamento, confirmação e delegação usam a trava da solicitação, evitando recriar atendimento após um cancelamento concorrente.
- Detalhes e resumo identificam dados salvos quando a atualização falha; não apresentam indisponibilidade como resultado zero. O formulário de perfil não salva uma edição baseada em cache indisponível para atualização.
- Datas mensais são agrupadas por Fortaleza, incluindo a virada de mês em UTC. Litros/unidades não são convertidos automaticamente em kg.

## Banco e implantação

Migração aditiva `20261028050000_residential_workspace`:

- `PersonProfile.savedAddresses`: JSON com lista vazia inicial;
- `Schedule.requestOperationId`: identificador único opcional;
- `Schedule.requestOperationHash`: hash opcional do pedido.

Não exclui nem migra titulares para outro papel. As telas da cooperativa dentro do App permanecem fora do escopo.

Atualize a API antes do App web:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Terminando com `active`, atualize o App web:

```bash
cd /var/www/katua/app && npm ci && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Atualize a aba com `Ctrl+Shift+R`. Não é necessário novo build do painel por esta entrega. Uma instalação nativa precisa receber a versão correspondente pelo fluxo de distribuição adotado; o export web não atualiza o binário instalado.

## Validação

**88 verificações automatizadas aprovadas**, detalhadas em `validacao-gerador-residencial-2026-10-28.json`:

- API local real: 44 verificações, incluindo 15 residenciais e 29 regressões de rotas, migrações, autorização e históricos;
- App web com API local real: 14 verificações, em 390px e desktop, incluindo perda de resposta após criação e retomada após recarregar;
- máscaras, datas, valores e envio persistente: 6 verificações;
- regressão offline dos demais perfis: 14 verificações;
- início de rota no App: 3 verificações;
- painel com API real, agrupamento e conferência independente: 7 verificações.

TypeScript do App e da API, ESLint dos arquivos alterados do App, build da API e export web aprovados. A migração foi aplicada sobre dados de perfil anteriores, preservando CPF/endereço. Os testes usam PostgreSQL descartável via PGlite; requisições do navegador são encaminhadas somente à API local. Nenhum acesso à VPS ou banco de produção.

Reprodução, na raiz do repositório:

```bash
KATUA_VALIDATION_TOOLS=/caminho/ferramentas node server/tests/residential/unit.cjs
```

```bash
KATUA_VALIDATION_TOOLS=/caminho/ferramentas APP_RELIABILITY=1 RESIDENTIAL=1 node server/tests/field-operations/run.mjs
```

```bash
KATUA_VALIDATION_TOOLS=/caminho/ferramentas KATUA_APP_DIST=/caminho/export KATUA_CHROMIUM_PATH=/caminho/chromium APP_RELIABILITY=1 RESIDENTIAL=1 RESIDENTIAL_UI=1 node server/tests/field-operations/run.mjs
```

## Conferência após atualizar

1. Entrar com uma conta residencial existente; conferir CPF, endereço e novo nome do perfil.
2. Adicionar um local salvo, salvar o perfil e reutilizá-lo na solicitação.
3. Digitar data/hora sem separadores e conferir a inserção automática.
4. Selecionar material sem estimativa, revisar e enviar. Conferir o mesmo protocolo no painel.
5. Reabrir o pedido pelo histórico e conferir preferência, confirmação e etapas reais.
6. Cancelar um pedido ainda em análise e confirmar que outro pedido já delegado não oferece essa ação.
7. Repetir um pedido, revisar os materiais e escolher uma nova data.
8. Conferir os resultados mensais depois do recebimento pela cooperativa; pedidos apenas enviados não alteram o peso.
9. Validar GPS, câmera dos PEVs, retorno após suspensão e teclado em celular físico.

## Limites e acompanhamento

- GPS, câmera, teclado nativo e suspensão em Android/iPhone físico continuam pendentes de teste no aparelho. A entrega não afirma ter executado esse teste.
- Não foi realizado teste de carga na produção nem instalação na VPS.
- A escolha por município ajuda a localizar cooperativas, mas não representa cobertura de atendimento confirmada. Essa confirmação continua sendo da equipe.
- Endereços salvos são persistentes na conta. O formulário ainda não enviado não é uma fila offline; a tentativa de envio pendente, por outro lado, fica preservada por titular no dispositivo.
- Chat, benefícios e NFC continuam sem serviço operacional e não são apresentados como funcionalidades prontas.
