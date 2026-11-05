# Recebimento guiado da cooperativa — 05/11/2026

## Problemas identificados e correções

1. No App, o estado da coleta vinculada à OC era exibido sem tradução (`COMPLETED`). Agora usa a tradução do ciclo de coleta.
2. A OC continuava exibindo apenas as quantidades do relato original após a conferência. A API agora retorna a versão da conferência e os materiais atuais da coleta vinculada. App e painel mostram os valores conferidos e mantêm o relato original separado/recolhido.
3. O acesso de recebimento no App apontava para uma rota antiga que redirecionava ao início. O App Web da cooperativa agora tem acessos explícitos para recebimentos e ordens extras; na ordem vinculada, o botão abre a coleta exata no painel. O painel usa sua própria sessão; não há transferência de token entre domínios.
4. Pesagem inicial de material sem quantidade informada era tratada como divergência contra zero. Agora, na primeira conferência, quantidade original nula e quantidade técnica zero permitem registrar o peso real sem justificar uma diferença fictícia. O servidor registra a nota de pesagem inicial. Divergências de quantidades conhecidas e correções posteriores continuam exigindo justificativa. O valor original nulo é preservado.
5. No painel, recebimento, pesagem, equipe, encaminhamento e conclusão apareciam juntos ou dependiam de trocar de tela. O novo `CollectionWorkflow` organiza o próximo passo e reutiliza os componentes e APIs existentes. Ações secundárias ficam recolhidas.

## Fluxo por origem

| Origem | Caminho |
|---|---|
| Solicitação extra ainda não realizada | Analisar OC → aguardar retirada → receber → pesar/conferir → encaminhar → concluir |
| Coleta extra já realizada | Analisar OC → receber material, se ainda não recebido → conferir → encaminhar → concluir |
| Coleta normal, PEV ou rota fixa/diária | Registrar a realização em campo → receber → conferir → dividir equipe, quando houver → encaminhar → concluir |
| Entrega na porta da cooperativa | Registrar entrada direta → abrir automaticamente o atendimento → separar e pesar → encaminhar → concluir |
| Coleta em endereço avulso | Registrar coleta → confirmar chegada pelo serviço próprio de entradas avulsas → separar e pesar → encaminhar → concluir |

A aprovação administrativa da OC permanece separada da chegada física. Receber antes da análise continua disponível como alternativa, sem aprovar automaticamente a ordem. Recusa e recursos de programação ficam recolhidos até serem necessários.

## Etapas no painel

O cabeçalho dos detalhes informa origem, situação e próximo passo. As etapas futuras ficam bloqueadas; etapas anteriores podem ser consultadas sem avanço automático. Alterações reais continuam exigindo os formulários e confirmações existentes.

1. **Recebimento:** confirmação da chegada física. Coletas comuns pendentes/em andamento aguardam o registro em campo; entradas avulsas usam `/material-intakes/:id/arrive`.
2. **Pesagem e conferência:** material ainda não informado fica com campo vazio, sem fingir que o catador informou zero. Entradas avulsas sem materiais usam a pesagem inicial com catálogo. Unidades são preservadas.
3. **Equipe:** aparece quando existem participantes; divisão desatualizada após nova pesagem precisa ser revista.
4. **Encaminhamento:** o formulário de destinação abre no mesmo atendimento, mantendo estoque, triagem, reserva, destinação direta, rejeito e descarte. Reutiliza o modal e validações existentes.
5. **Conclusão:** mantém as verificações de conferência, saldo, equipe e ocorrências. Encerrar a coleta não encerra materiais que continuam em estoque, triagem ou reserva. Esses registros recebem acesso direto para continuidade.

Se o envio de um encaminhamento for confirmado, mas a consulta do saldo atualizado falhar, o formulário é fechado, o registro não é reenviado e as próximas operações ficam bloqueadas até uma atualização bem-sucedida. Durante operações, o fluxo bloqueia ações concorrentes. Escape no modal de destinação fecha somente esse modal e preserva os detalhes da coleta.

## APIs e dados

Não foram criadas tabelas ou migrations. A consulta da OC amplia somente o `select` da coleta vinculada para incluir `quantityReviewVersion`, `quantitiesReviewedAt` e `collectionMaterials` com ID, nome, quantidade e unidade. Escopo por cooperativa e catador permanece no serviço existente. Não retorna fotos adicionais, credenciais ou documentos pessoais.

As APIs operacionais existentes continuam responsáveis por permissões, transições, saldo e concorrência. A mudança de justificativa se limita à primeira pesagem de material sem quantidade original; não remove a auditoria de correções.

## Validação

- TypeScript do App e do backend: aprovado.
- Build do backend, export Expo Web/PWA e build React/Vite: aprovados.
- ESLint dos arquivos de interface alterados: aprovado.
- 12 testes de integração Fastify/Prisma em PGlite descartável, ampliados para conferir os dados atuais na OC e preservar o bloqueio de divergência conhecida sem justificativa.
- 13 testes do App Web em navegador com APIs interceptadas: incluem estado traduzido, quantidade atual e acesso da cooperativa ao registro exato do painel, além das regressões de rascunho/offline.
- 12 testes das regras de próximas etapas: origens normais, avulsas, entrega direta, conferência, equipe, ocorrências, saldo, cancelamento e acompanhamento posterior.
- 10 testes do painel em navegador com APIs simuladas: recebimento, pesagem sem divergência fictícia, modal no mesmo atendimento, teclado, estoque/conclusão, falha de consulta após gravação sem reenvio, entradas avulsas, criação de entrega direta com navegação e mobile.

Total: **47 cenários aprovados**. Não equivale a homologação em celular físico ou no banco de produção. As rotinas não acessam a VPS; as chamadas dos navegadores são interceptadas. Permanecem os avisos anteriores de bundle e ferramentas, sem impedir os builds.

Reprodução: `KATUA_VALIDATION_TOOLS=/caminho/ferramentas node server/tests/collector-web/run.mjs`; testes de App com `KATUA_APP_DIST`, `KATUA_CHROMIUM_PATH` e `KATUA_VALIDATION_TOOLS` em `server/tests/collector-web/browser.mjs`. No Katua_Web, executar `node --test tests/receiving/workflow.test.mjs` e o runner `tests/receiving/browser.mjs` com `KATUA_PANEL_DIST` e ferramentas locais. Os servidores de navegador usam apenas loopback.

## Publicação posterior

Atualizar backend, App Web e painel com seus comandos habituais, nessa ordem. Não há migration nova. Nenhum comando foi executado na VPS; nenhuma configuração Nginx ou .env de produção foi alterada. Não foram produzidos APKs ou builds iOS. As novas rotas da cooperativa são específicas para Web.

Se houver necessidade de rollback, reverter conjuntamente os commits desta entrega nos dois repositórios e refazer os builds das versões anteriores; os dados não precisam ser apagados ou redefinidos. Preservar a alteração local conhecida em `server/src/server.ts` que mantém o host da API em 127.0.0.1.
