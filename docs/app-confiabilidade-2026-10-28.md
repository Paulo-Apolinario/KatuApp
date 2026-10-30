# App: confiabilidade, históricos e operação em campo — 28/10/2026

## Escopo e situação

Solicitação autorizada: tópicos 1, 2, 3, 4 e 6. A modalidade de transporte (tópico 5) não foi alterada. Nenhum arquivo de tela do perfil `(cooperativa)` foi modificado. O painel não recebe mudança funcional nesta entrega; este documento também fica no seu repositório para manter o acompanhamento.

| Tópico | Entrega | Situação |
| --- | --- | --- |
| 1. Validar rotas | Preparação pela cooperativa, partida pelo integrante, operação em campo, agrupamento por execução, conferência individual e isolamento entre cooperativas | Validado em API local e navegadores; conferir em produção após atualizar |
| 2. Avisos | Falha, vazio confirmado e leitura do cache diferenciados nas telas revisadas; nova tentativa; dados anteriores preservados | Implementado e testado |
| 3. Históricos | Histórico de solicitações de PF, comprovantes do catador e ocorrências do motorista com páginas de 25, limite máximo 50 no servidor | Implementado e testado |
| 4. Offline | Central por operação, erro e tentativas; envio por entidade em ordem; espera crescente no reenvio automático; retomada ao voltar ao App | Implementado e testado com transporte controlado |
| 6. Aparelho físico | Roteiro abaixo; localização simulada validada para sucesso, negativa, posição inválida e ausência de HTTPS | **Pendente em Android/iPhone real** |

## Comportamento entregue

- O catador e o motorista têm acesso à **Central de sincronização** pelo perfil. Havendo pendências, o aviso com atalho aparece no topo destes perfis. A central mostra etapa, coleta/rota, data, falha e tentativas. Exibe inicialmente até 50 operações e permite mostrar mais.
- Uma tentativa individual reenvia a sequência da mesma entidade, com as etapas anteriores primeiro. Não há botão para apagar pendências. A fila continua vinculada ao titular da conta.
- O identificador da operação de campo é preservado no reenvio. A API foi testada com repetição de início e conclusão, inclusive após o recebimento: não duplica entrada nem faz o material voltar de etapa.
- Reenvio automático após falha usa espera crescente de até cinco minutos. A tentativa manual ignora a espera. Chamadas simultâneas continuam compartilhando o envio ativo.
- Estado de conectividade ainda desconhecido não é tratado como certeza de ausência de rede. Falta de acesso confirmada continua bloqueando o envio.
- Voltar ao primeiro plano dispara a sincronização e a atualização da rota aberta. O timer não inicia novos envios enquanto o App está suspenso.
- Início, coleta, indicadores do catador, ranking e execução de rota identificam uso de dados salvos. Falha de atualização não apaga os dados anteriores nas telas revisadas. A data de sincronização do catador usa a última consulta remota, sem marcar leitura de cache como atualização do servidor.
- Abrir uma rota projeta as pendências sobre seus próprios pontos, sem buscar todo o histórico de coletas. A listagem geral lê a fila uma vez para aplicar as projeções, em vez de consultar a fila novamente para cada coleta.
- Os históricos usam data de corte e ordenação por criação + identificador, inclusive quando várias linhas têm a mesma data. As permissões existentes são mantidas. Páginas novas exigem conexão; erro preserva os registros já carregados na tela.
- O **comprovante consolidado continua completo**: apenas ao gerar, busca todas as páginas de coletas concluídas. Se uma página falhar ou a conta mudar, a geração é interrompida. A paginação não transforma os indicadores gerais em totais de uma única página.
- A API só usa paginação quando recebe `page`. Clientes legados mantêm o contrato anterior. Nos comprovantes paginados de `/collections`, entram somente coletas concluídas.

## Banco e atualização

Migração aditiva: `20261028040000_app_history_pagination`. Cria cinco índices para consultas por titular, motorista, cooperativa, etapa e ordem de criação. Não exclui ou mescla registros.

API, incluindo migrações:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

App web, após a API:

```bash
cd /var/www/katua/app && npm ci && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Atualize a aba do App com `Ctrl+Shift+R`. O painel já publicado no ciclo anterior permanece funcional; não exige novo build por esta entrega. Aplicativos nativos instalados precisam receber uma versão com este código pelo fluxo de distribuição adotado; exportar para web não atualiza o binário instalado.

## Evidências automatizadas

**61 verificações aprovadas**, registradas em `validacao-app-confiabilidade-2026-10-28.json`:

- 29 na API real com PostgreSQL descartável via PGlite: 21 de rotas + 8 de históricos e reenvio idempotente.
- 14 de armazenamento persistente, sincronização, exportação completa, conectividade, GPS simulado e ordem cronológica do comprovante.
- 8 nas telas do App web a 390px, com transporte controlado: páginas, erro, vazio, central, ordem de reenvio, comprovantes e ocorrências.
- 3 de regressão de preparação/partida no App web.
- 7 no painel com API local real: agrupamento, contagem, detalhe e conferência independente dos pontos, inclusive celular.

TypeScript do App e da API, ESLint dos arquivos alterados do App, build da API e exportação web aprovados. Nenhum acesso à VPS ou banco de produção. Isso não representa teste de carga de produção nem teste de sensores em aparelho físico.

Comandos de reprodução local, com ferramentas de validação e Chromium disponíveis:

```bash
KATUA_VALIDATION_TOOLS=/caminho/ferramentas APP_RELIABILITY=1 node server/tests/field-operations/run.mjs
```

```bash
KATUA_VALIDATION_TOOLS=/caminho/ferramentas node server/tests/app-reliability/offline.cjs
```

```bash
KATUA_VALIDATION_TOOLS=/caminho/ferramentas KATUA_APP_DIST=/caminho/export KATUA_CHROMIUM_PATH=/caminho/chromium node server/tests/app-reliability/browser.mjs
```

## Roteiro de campo: executar depois de atualizar

Usar registros de teste, a conta da cooperativa no painel e as contas de catador/integrante e motorista no celular. Não limpar dados do App com operações pendentes.

| Passo | Ação | Resultado esperado |
| --- | --- | --- |
| 1 | Cooperativa programa uma execução com três locais diferentes, inclusive um PEV, e adiciona um integrante | Uma execução agrupada; três registros individuais |
| 2 | Tentar iniciar antes de a cooperativa definir motorista/veículo | App explica que aguarda preparação e não solicita ao catador configurar recursos |
| 3 | Cooperativa define recursos; integrante abre a rota e confirma saída | Execução em campo; indicador aumenta uma vez; pontos aguardando atendimento ficam contextualizados como em campo |
| 4 | Iniciar um ponto; concluir e receber somente esse ponto | Demais locais mantêm seus estados; conferência e material pertencem ao ponto correto |
| 5 | Iniciar uma coleta individual delegada fora da rota | Indicador soma essa operação sem duplicar os pontos da rota |
| 6 | Carregar uma coleta online; ativar modo avião; registrar início e conclusão | Registros aparecem pendentes de envio; os mesmos dados permanecem ao fechar e reabrir o App |
| 7 | Voltar a ter conexão e abrir a central | Etapas enviadas em ordem; pendências somem somente após confirmação; painel não duplica coleta/material |
| 8 | Simular falha de envio; usar tentativa individual na conclusão | O início anterior é resolvido primeiro; falha permanece explicada se o servidor rejeitar |
| 9 | Suspender o App com uma operação pendente e retornar depois de reconectar | Fila é retomada; rota aberta se atualiza; não é necessário iniciar uma segunda rota |
| 10 | No mapa, negar localização, depois permitir; testar com GPS desligado e ligado | Mensagens compreensíveis, nova tentativa e localização real coerente; sem tela branca |
| 11 | Na ordem extra ou solicitação de PEV, abrir câmera; negar, permitir e cancelar; tirar foto e salvar | Cancelamento mantém o formulário; foto anexada ao registro certo; negativa permite tentar novamente |
| 12 | Abrir históricos com mais de 25 registros; avançar; cortar internet e tentar atualizar | Segunda página sob demanda; registros visíveis preservados; falha não é apresentada como lista vazia |
| 13 | Gerar comprovante consolidado com mais de 25 coletas concluídas | Documento inclui todas as páginas, com quantidades e créditos corretos; falha intermediária não produz documento parcial |
| 14 | Sair com pendência e entrar em outra conta; depois voltar à conta original | Outra conta não vê nem envia os dados da anterior; a conta original recupera sua fila |

Registrar aparelho, versão do sistema, navegador ou versão instalada, perfil, etapa, horário e resultado. O teste físico só pode ser marcado como concluído após executar o roteiro e conferir os resultados reais.

## Próximos itens, fora desta entrega

- Executar e registrar o roteiro em aparelho físico.
- Modalidades de transporte configuráveis pela cooperativa (tópico 5, não autorizado neste ciclo).
- Avaliar endpoints agregados para indicadores que ainda dependem de listas completas, sem reduzir os totais à página visível.
- Revisar chat/loja indisponíveis do perfil PF e demais telas antigas em um ciclo próprio.
