# Cooperativa: gestor em campo - 31/10/2026

## Nova navegação

Início sem indicadores operacionais: Catadores, Motoristas, Geradores, Adicionar gerador, PEVs e Relatórios e análises. Mantidos identificação da cooperativa, notificações e saída da conta. O início não solicita GPS nem carrega coleções completas para montar resumos.

Catadores e motoristas têm diretório pesquisável e trabalhos paginados, com equipe, situação, materiais por unidade e ocorrências. Participação de colaboradores aparece mesmo quando não são o catador principal. Quantidades da coleta são identificadas como coletivas; produção individual é consultada no relatório de equipe, com as regras existentes de divisão.

Geradores mostram cadastro, classificação por CPF/CNPJ, endereço, solicitações recentes, coletas, ocorrências e localização. O cadastro pelo App distingue pequeno/residencial cadastrado e grande gerador; CPF de pequeno gerador continua sendo um cadastro cooperativo, sem transformar o perfil residencial independente do App. Endereço e confirmação de coordenadas são exigidos no novo formulário. Consulta de CEP preserva dados recentes e invalida confirmação após alterações do endereço. Busca geográfica inclui número e cidade e pode ser corrigida no mapa/GPS.

PEVs têm busca, cadastro com código próprio, materiais aceitos, endereço, confirmação de posição, consulta de atendimentos e mapa. Novos PEVs são privados da cooperativa. Mapas de diretório mostram uma página de até 20 locais, com total e navegação explícitos; cadastros sem coordenadas não recebem posições inventadas.

Relatórios com seletor de assunto: visão geral, coletas, materiais, catadores, motoristas, veículos, estoque e destinações. Reutilizam /reports e seus cálculos e permissões do painel; datas com máscara dd/mm/aaaa, até 366 dias e paginação. Gráficos da visão geral mostram situações e materiais; barras de materiais comparam apenas a mesma unidade. Saldo de estoque é identificado como atual, não histórico.

Entradas das telas antigas da Cooperativa viram redirecionamentos para a nova navegação, sem excluir registros, anexos ou históricos. Funções administrativas não incluídas nesta versão permanecem disponíveis no painel web. Os perfis residencial, gerador e catador não foram redesenhados nesta entrega.

## Localização do motorista

O motorista inicia o compartilhamento no próprio App, selecionando rota delegada agendada/em campo ou coleta individual pendente/em campo. Não há ativação remota pelo gestor. O motorista dispõe de controle visível em todas as telas para acessar início/encerramento.

A API valida usuário, conta, motorista ativo, cooperativa e vínculo ao serviço. Guarda somente a posição mais recente por motorista, sem histórico de percurso. Cada início cria nova sessão e invalida o aparelho/sessão anterior. Pontos fora de ordem não substituem os atuais; pontos antigos ou futuros e coordenadas inválidas são rejeitados.

O gestor consulta apenas motoristas de sua cooperativa. A tela mostra motorista, serviço, coordenada no mapa, precisão e horário do GPS com segundos. Consulta a cada 5 segundos somente com a tela em foco e o App ativo. Até 45 segundos: atualizado; depois: desatualizado; acima de 2 minutos: sem atualização recente. Falha de rede nunca apresenta o marcador como posição atual. Encerrar o compartilhamento remove coordenadas da resposta; finalizar/cancelar/redelegar o serviço ou bloquear a conta impede novas posições e impede consulta indevida.

Web usa GPS enquanto o App está aberto. Native usa expo-task-manager compatível com SDK 54 e expo-location. Segundo plano requer permissões e build nativo atualizado. Android usa serviço com notificação visível; iOS configura modo location e indicador. Se segundo plano não estiver disponível ou autorizado, o modo com App aberto é identificado na tela. Não há fila offline de pontos antigos enviada como se fosse localização atual.

Sair da conta/sessão expirada encerra envio local. Sessão de compartilhamento é vinculada ao usuário autenticado. Para motorista que ativa segundo plano, o token fica no SecureStore deste aparelho com acesso após primeiro desbloqueio, necessário ao envio com tela bloqueada. O padrão de armazenamento dos demais usos permanece quando desbloqueado. Sessão sem tarefa nativa ativa, ao reabrir o App, é encerrada e requer novo início. Aplicativo forçadamente fechado, restrição de bateria, sinal e rede podem interromper atualizações; o gestor vê o último horário, sem promessa de continuidade absoluta.

## API e migração

GET /cooperative-field/:kind: diretório paginado de collectors, drivers, generators ou pevs.
GET /cooperative-field/:kind/:id: cadastro, trabalhos paginados, resumo e solicitações recentes quando aplicável.
POST /cooperative-field/geocode: endereço completo e resultado para confirmação manual, com timeout e fallback.
GET /driver-tracking/context: serviços delegados disponíveis ao motorista.
POST /driver-tracking/start: sessão por rota ou coleta.
PUT /driver-tracking/position: posição atual da sessão.
POST /driver-tracking/stop: encerra sessão.
GET /driver-tracking/drivers/:id: consulta protegida do gestor.

Migração 20261031010000_driver_live_location: tabela DriverLiveLocation e vínculo opcional ao Driver. Não altera cadastros, quantidades, status de coletas, documentos internos nem históricos existentes. Aplicar migrações e reiniciar katua-api.service antes de usar o App atualizado.

## Implantação

API: git pull na main, npm ci em server, prisma:generate, prisma:deploy, check, build e reinício de katua-api.service.
App Web: npm ci na raiz e EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist. A publicação do domínio depende de o Nginx servir esse diretório; exportar não muda automaticamente a raiz do Nginx.
APK de teste: npx eas-cli build --platform android --profile preview na raiz. Perfil preview já existe e aponta à API atual. Instalar a nova versão nos aparelhos, especialmente no motorista. Atualização de JavaScript não adiciona permissões/módulos ao binário antigo. Para iOS, usar o processo de distribuição configurado para os aparelhos da cooperativa.

## Verificação e teste de campo pendente

TypeScript do App e da API, build da API e exportações Web/Android/iOS. Testes de navegador com API real local e PostgreSQL descartável: início, diretórios, trabalhos, cadastro por CPF, confirmação/invalidação de coordenadas, cadastro e mapa de PEV, relatórios e GPS simulado do motorista ao gestor. Regressões incluem documentos internos, estoques, coletas, comunicação, pendências e isolamento de cooperativas. O adaptador dos testes de contratos passou a resolver módulos externos pelo Node, permitindo carregar React usado pelo serviço de estado existente.

Validar no APK instalado: duas contas (motorista e cooperativa); iniciar serviço e compartilhamento; caminhar/deslocar e conferir marcador, horário e precisão; bloquear tela e alternar App; negar/revogar permissões; desligar rede/GPS; encerrar serviço, compartilhar novamente e sair da conta. Conferir comportamento e bateria no modelo real do aparelho. Esse teste físico não foi executado aqui.
