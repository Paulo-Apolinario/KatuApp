# Melhorias gerais do app KATUÁ — 22/10/2026

## Entrega e escopo

Implementação autorizada após a auditoria `docs/auditoria-geral-app-2026-10-22.md`. O fluxo de campo → recebimento → triagem → destinações → encerramento permanece separado por responsabilidade. Paulo confirmou que conseguiu executá-lo corretamente. A auditoria anterior continua como registro histórico dos defeitos encontrados; seus testes de diagnóstico não são regressões da versão corrigida.

Esta entrega atualiza KatuApp (app Expo e API) e Katua_Web (painel). Não acessa nem atualiza a VPS. Não altera credenciais, dados reais ou configurações locais de ambiente. Banco, API, painel e app precisam ser atualizados em conjunto.

## Backlog implementado

| ID | Entrega |
| --- | --- |
| APP01 | Solicitação PF com cooperativa, catálogo real, estimativas opcionais, proposta de novo material e contrato aceito pela API. Endereço de retirada e ponto confirmado no mapa ficam registrados na solicitação. |
| APP02 | Sair utiliza `signOut`, limpa credencial e contexto. Confirmação adaptada ao navegador e ao nativo. Pendências de trabalho não são apagadas. |
| APP03 | Resposta 401 encerra a sessão; indisponibilidade de rede permite consulta aos dados locais. Resposta atrasada de uma sessão antiga não deve apagar uma nova autenticação. |
| APP04 | Cache de agendamentos isolado pela conta, inclusive quando duas contas acessam o mesmo ID. Registros legados sem titular não são apresentados a outra conta. |
| APP05 | Normalização e comprovantes preservam quantidade e unidade (kg, t, L, un, m³). Litros/unidades não são somados como massa; toneladas são convertidas para kg nos totais de massa. |
| APP06 | Data de agendamento valida dia, mês, ano e horário sem normalizar datas impossíveis. Solicitação exige horário futuro e usa Fortaleza (UTC−03). |
| APP07 | Planejador de rotas no app seleciona coletas reais, mostra origem/equipe/materiais/mapa, permite ordenar visitas e envia os vínculos para a transação existente da API. Edição conserva histórico e impede salvar rota encerrada. |
| APP08 | Catador registra ocorrência em vez de tentar cancelar. Relato fica na fila offline quando necessário; cooperativa registra o tratamento no app ou no painel. Encerramento fica bloqueado enquanto houver ocorrência aberta. |
| APP09 | Mapas reconhecem PEV, gerador e endereço de solicitação PF. Normalização de rotas preserva a origem PEV e a sequência operacional. |
| APP10 | Indicadores da cooperativa contemplam as sete etapas e agrupam materiais pela unidade. Não exibem meta fictícia de 1.000 kg. |
| APP11 | Layout do motorista protegido pelo perfil DRIVER, inclusive acesso direto por URL. |
| APP12 | Mapa web Leaflet com marcadores numerados, seleção, sede, GPS e sequência de visitas. Sem mapa de fundo, a lista continua disponível. Marcadores nativos também recebem numeração. |
| APP13 | Dashboard e mapas consultam o horário real da última resposta remota; leitura do cache não atualiza falsamente a sincronização. Etapas posteriores ao campo indicam responsabilidade da cooperativa. |
| APP14 | Notificações aceitam objeto com título/mensagem/tipo; chamadas ambíguas corrigidas nas telas. |
| APP15 | Atalho Perfil do catador abre perfil real, com atualização do nome, consulta dos dados, recuperação por e-mail, pendências de sincronização e saída. PF/gerador deixam de simular salvamento de perfil. E-mail e dados operacionais restritos aparecem somente para consulta. |
| APP16 | Chat, NFC e loja indicam indisponibilidade. Estoque da cooperativa aponta para a gestão real no painel, sem apresentar tela demonstrativa como estoque integrado. |
| APP17 | Engajamento PF usa materiais estruturados e explica que mede solicitações. Não representa pesagem real nem ranking global de cooperativas. |
| APP18 | API com prazo de conexão, cancelamento automático ao exceder o limite e tratamento central de 401; consulta externa também tem prazo. Logs de respostas/detalhes de rede limitados ao desenvolvimento. |
| APP19 | Dashboard e home da cooperativa preservam dados anteriores quando uma seção falha e informam a seção que não pôde ser atualizada. |
| APP20 | Solicitação PF tem mensagem de falha única, atualização de cooperativas e formulário preservado após erro. Reenvio exige conferir solicitações quando a resposta foi perdida. |
| APP21 | `eas.json` consolidado na raiz, com a API HTTPS atual. Arquivo duplicado sob `app` removido. Variáveis locais não foram versionadas. |
| APP22 | Cleartext Android deixa de ser habilitado por padrão; HTTP depende de opção explícita de desenvolvimento `KATUA_ALLOW_HTTP=1`. |
| APP23 | Tema, espaçamentos, componentes de formulário e hook de sincronização compartilhados implementados. Arquivos antes vazios passam a apontar para o mecanismo real de fila. |
| APP24 | Dependências exclusivas do backend retiradas do pacote do app, mantendo-as no servidor. Configuração de tipagem separa app e API; novos componentes e utilitários reduzem duplicação. |

Os itens acima descrevem mudanças de código entregues. Homologação em aparelhos físicos, publicação de APK/AAB/iOS e testes de carga não foram executados e estão registrados abaixo como pendentes.

## Fluxos novos e regras

### Ocorrências

- `POST /collections/:id/report-incident`: catador designado ou cooperativa responsável. Descrição de 5 a 2.000 caracteres. Identificador de operação permite reconhecer reenvio sem duplicar o relato.
- `POST /collections/:id/incidents/:incidentId/resolve`: somente a cooperativa responsável. Tratamento de 5 a 2.000 caracteres, autor e data registrados. Um tratamento concluído não é sobrescrito.
- Relatar ou tratar ocorrência não cancela a coleta, não cria lote, não altera massa nem avança a etapa. A cooperativa utiliza as ações operacionais existentes para essas decisões.
- A ocorrência acompanha a consulta da coleta. Encerramento exige que todas estejam tratadas, além das validações existentes de saldo e reservas.
- No catador: escrever o relato nas observações e usar Informar problema. Offline significa salvo no aparelho e aguardando envio, não recebido pela cooperativa.
- No painel: Lista de Coletas → detalhes → ocorrências. No app cooperativa: Recebimento e ocorrências.

### Recebimento no app

A central da cooperativa oferece Confirmar recebimento (COLLECTED), Iniciar triagem (RECEIVED) e Concluir operação (SORTING). Cada etapa mostra orientação e exige confirmação explícita. São ações online; leitura local não confirma recebimento na API. Destinações e estoque continuam sendo conferidos e registrados no painel; o app não cria uma segunda entrada manual.

### Solicitação PF e planejamento

Endereço é obrigatório na nova tela PF; coordenadas são opcionais e só são enviadas quando há escolha explícita no mapa ou uso do GPS. A posição do aparelho não é assumida como endereço de retirada. A API mantém compatibilidade com clientes anteriores, nos quais esses campos são opcionais. Dados antigos sem endereço/coordenadas não recebem localização fictícia.

Rotas passam a vincular IDs de coletas e manter a sequência. Paradas textuais antigas são preservadas como referências. Materiais de unidades distintas não viram automaticamente carga em kg. Recursos indisponíveis são filtrados; a API continua revalidando equipe, veículo e execução. Aviso de mesma data não representa prova de conflito de horário.

### Sessão e dados locais

No nativo, token migra para SecureStore e sua cópia legada em AsyncStorage/SQLite é removida ao recuperar a sessão. No web permanece o armazenamento suportado pelo navegador. A fila fica associada à conta e não é apagada ao sair. Essa migração foi verificada com adaptadores controlados; perda/restauração de chave do sistema operacional depende de homologação em aparelho.

## Interface e mapas

Cores de ação, espaçamentos e cabeçalhos foram alinhados; as telas novas usam cartões, campos com rótulos, alvos de toque e estados de carregamento/erro. A raiz passa a respeitar áreas seguras. As listas novas permitem busca e exibição incremental.

O mapa web utiliza Leaflet instalado no projeto e tiles do OpenStreetMap. A linha pontilhada mostra ordem de visita, sem afirmar cálculo de distância, tempo ou percurso viário. GPS corresponde ao aparelho em primeiro plano; sede corresponde ao cadastro da cooperativa. Não foi implementado rastreamento remoto contínuo da frota. O fundo do mapa depende do serviço externo, conexão e política do provedor; pontos e lista não dependem de geocodificação na abertura.

## Migração e atualização

Nova migração: `20261022230000_collection_incidents`. Cria `CollectionIncident`, índices de escopo/reenvio, vínculo restritivo com Collection e os campos de endereço/coordenadas de retirada em Schedule. É aditiva; não reescreve destinações ou lotes históricos. Deve ser aplicada com `prisma migrate deploy`, nunca registrada como já aplicada sem executá-la.

Sequência para Paulo atualizar:

1. Atualizar `main` de KatuApp e Katua_Web, preservando configurações locais e arquivos enviados.
2. Em `/var/www/katua/app/server`: instalar dependências, gerar Prisma Client, aplicar migrações pendentes e gerar build.
3. Reiniciar `katua-api.service` e conferir serviço/health/logs.
4. Em `/var/www/katua/frontend/frontend`: instalar dependências e gerar build do painel.
5. Na raiz `/var/www/katua/app`: instalar dependências e exportar Expo web com o ambiente público correto; publicar `dist` no diretório configurado no Nginx para `app.katua.com.br`. O caminho final deve ser lido da configuração existente, não presumido.
6. Atualizar a compilação instalada do app nativo para receber as mudanças nativas. Exportar JavaScript Android não gera um APK instalável.
7. Conferir solicitação PF, roteiro, catador/campo, ocorrência, recebimento, triagem, destinações e encerramento com usuários de teste.

Nenhuma etapa de deploy foi executada na VPS nesta entrega. A API pública usada pelo app é `https://vps.katua.com.br`, sem acrescentar `/api` arbitrariamente.

## Validação e reprodução

Evidências consolidadas em `docs/validacao-melhorias-gerais-app-2026-10-22.json`. Resultado: 9 regressões de contrato, 11 de fila offline e 25 cenários de API/navegador aprovados. TypeScript do app e da API aprovados; ESLint do app e dos arquivos alterados do painel sem erros ou avisos; builds API/Vite e exportações Expo web/JavaScript Android concluídos. Vite mantém aviso de tamanho de chunks.

- `npm run check` na raiz: TypeScript do app.
- `npm run check` e `npm run build` em server: tipagem e build da API.
- `npx eslint app src` na raiz; ESLint dos arquivos alterados do painel.
- `npm run test:app`: regressões dos contratos (data, unidades/PDF, sessão, cache, SecureStore e rota).
- `node server/tests/flow-corrections/offline.cjs`: serviços/repositórios reais com rede/armazenamento controlados, incluindo ocorrência offline e retomada da fila.
- `frontend/tests/app-upgrade.mjs`: banco PostgreSQL descartável via PGlite, Prisma/Fastify reais, migração nova, testes de API e navegação com Chromium. Fixture local em `server/tests/app-upgrade/local-server.ts`. Executar com módulos de PGlite/Playwright/Chromium disponíveis e caminhos indicados nas variáveis do script. Não usa a VPS.
- Exportação Expo web e bundle JavaScript Android; build Vite do painel.

## Backlog de homologação e evolução

| Prioridade | Pendente | Critério de aceite |
| --- | --- | --- |
| P1 | Homologar Android/iOS físicos | GPS negado/aproximado, áreas seguras, teclado, mapa, logout, cofre de token e fila após reinício verificados nos aparelhos usados. |
| P1 | Atualizar ambientes com Paulo | Migração aplicada, API ativa, painel/app web publicados e ciclo completo executado com contas de teste. |
| P2 | Mapas com grande volume | Medir antes de adicionar agrupamento e virtualização; testar centenas de pontos e a cobertura/limites do provedor. |
| P2 | Acessibilidade e desempenho completos | Validar leitor de tela, texto ampliado e foco em todas as telas, além dos controles novos; medir listas legadas antes de reescrever. |
| P2 | Recuperar dados históricos incompletos | Cooperativa confirmar endereços/coordenadas ausentes sem inferir valores; não associar cache antigo sem titular a uma conta automaticamente. |
| P3 | Recursos futuros | Chat, NFC, comércio, evidências fotográficas e rastreamento remoto exigem escopo próprio e homologação. A sinalização de indisponibilidade não implementa esses serviços. |

A nova central permite operação no app, mas não substitui as telas de destinação/estoque do painel. Ausência de falhas nos testes não significa certificação de todas as telas ou de todos os aparelhos.
