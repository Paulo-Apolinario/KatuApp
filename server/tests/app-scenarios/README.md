# Dez casos de uso do App Web — 04/11/2026

Executa o export real do Expo em Chromium, em 390 × 844 px, usando API local e PostgreSQL descartável via PGlite. Não abre o painel. Não acessa dados de produção, não envia e-mails reais e não gera builds nativos. ViaCEP, geocodificação e GPS são simulados; os demais serviços são encaminhados à API local.

## Execução

```bash
EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
APP_SCENARIOS_UI=1 COOPERATIVE_FIELD=1 FIELD_MEETING=1 BROWSER_OFFLINE=1 WASTE_USABILITY=1 KATUA_VALIDATION_TOOLS=/caminho/validation-tools KATUA_APP_DIST="$PWD/dist" node server/tests/field-operations/run.mjs
```

O diretório de validação deve conter Playwright, Chromium em `/tmp/katua-pev-browser`, PGlite e pglite-socket. A montagem do banco usa as migrações e serviços existentes para gerar as situações necessárias aos testes do App. O runner sobe a API em 3339 e o App em 5180; encerra e descarta o banco ao terminar. O resultado fica em `app-scenarios-ui-evidence/results.json`, sem tokens ou dados de produção.

| Caso | Perfil | Situação e resultado esperado |
|---|---|---|
| UC01 | Cooperativa | Selecionar e confirmar um ponto, trocar CEP, refazer as buscas por botão. Endereço e coordenadas mudam, confirmação é invalidada e o novo marcador permanece visível no mapa. |
| UC02 | Cooperativa | Trocar CEP durante uma resposta lenta de CEP e durante geocodificação. Somente o endereço atual pode atualizar o formulário e o mapa. |
| UC03 | Cooperativa | CEP inexistente não permite reutilizar ponto anterior; GPS e confirmação manual permitem correção. Rascunho sobrevive ao reload, salva gerador e abre seu cadastro após sincronização. |
| UC04 | PEVs | Corrigir CEP no cadastro de PEV, confirmar, salvar, sincronizar e abrir. Servidor contém um único PEV com as coordenadas corrigidas. |
| UC05 | Cooperativa / geradores | Buscar 22 cadastros, consultar a segunda página, mudar o filtro e abrir atendimentos e mapa de um gerador. Paginação e filtro preservam o contexto correto. |
| UC06 | Relatórios e análises | Rejeitar data impossível e intervalo invertido; recuperar erro 503 com nova tentativa. Relatório apresenta resultado após recuperação e estoque é identificado como saldo atual. |
| UC07 | Motorista / cooperativa | Negar e depois autorizar GPS, acompanhar localização, incluir ponto durante rota e encerrar compartilhamento. Coordenadas deixam de ser expostas após encerrar. |
| UC08 | Catador | Após preparação automática e controle da página pela PWA, iniciar coleta offline, registrar observações, recarregar e reconectar. Dados locais sobrevivem; a API só confirma início após sincronização. |
| UC09 | Catador / cooperativa | Consultar uma coleta de óleo concluída, recebida e conferida no histórico e no trabalho do catador. Ambos preservam 50 L, sem conversão fictícia para kg. |
| UC10 | Gerador | Aceitar termo pelo titular; rejeitar data/hora impossíveis; corrigir, selecionar material, informar 2,5 e enviar solicitação real à API local. Máscaras, quantidade e retorno ao painel do gerador são conferidos. |

Os testes aguardam a confirmação persistida de rascunho e o encerramento de requisições; o estado visual de envio não é tratado como confirmação remota. A PWA precisa completar sua preparação inicial com internet antes do teste de reabertura offline.
