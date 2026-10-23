# Acesso por e-mail e recuperação de senha — 19/10/2026

## Decisão e escopo

Autorizado pelo responsável: preservar o desenho atual do login e acrescentar a escolha Senha / Acesso rápido no app e no painel. Senha continua sendo a opção inicial. O acesso rápido envia um link ao e-mail cadastrado; não cadastra usuários e não muda seus perfis ou cooperativas.

Nenhuma alteração na VPS, entrega de e-mail real, migração de produção ou publicação foi executada. Não foram utilizados dados ou credenciais da operação.

## Comportamento

- POST /auth/login-link aceita email, audience APP/PANEL e profile opcional. O painel só permite COOPERATIVE. No app, quando um perfil é selecionado, a solicitação exige a correspondência com o perfil da conta.
- A resposta de solicitação não retorna token e usa uma mensagem genérica para contas ausentes, inativas ou incompatíveis. SMTP sem configuração retorna falha, sem afirmar que houve envio.
- O e-mail de acesso usa /quick-login#token=... no domínio correspondente. O fragmento não é enviado ao servidor web. A tela remove o fragmento do histórico e só consome o token depois de Confirmar acesso, evitando consumo por abertura automática do endereço.
- POST /auth/login-link/consume recebe token e audience. Valida finalidade, domínio lógico, validade e conta ativa, e reclama o token com update condicional dentro de uma transação. Somente o primeiro consumo válido emite sessão. O painel mantém também sua verificação de perfil no cliente.
- Token aleatório de 32 bytes, validade de 15 minutos e armazenamento somente como SHA-256. Login e recuperação têm finalidades separadas. Novos registros não usam os campos antigos de reset do usuário.
- Limites: 3 solicitações emitidas por conta em 15 minutos, compartilhadas entre recuperação e acesso; 20 solicitações/tentativas por IP em 15 minutos no processo. A contagem por conta não é uma garantia de exclusão concorrente. O limite por IP só aceita o último endereço encaminhado por uma conexão de loopback; outros proxies exigem revisão da topologia antes da publicação. Em múltiplos processos/instâncias, acrescentar limite compartilhado/proxy. Tokens vencidos há mais de 24 horas são removidos nas solicitações seguintes.
- App Web permite continuar no aplicativo instalado via esquema katua://quick-login. Isso exige uma versão do aplicativo que já contenha a nova tela. O caminho HTTPS continua funcionando no navegador; não foi configurada associação universal de domínio no Android/iOS.

## Recuperação preservando a senha atual

Antes, a solicitação trocava imediatamente passwordHash pela senha temporária, mesmo sem SMTP configurado. Agora, a senha atual só muda na conclusão válida da redefinição. A senha temporária continua no formulário existente, mas seu hash fica no registro de recuperação, separado da senha da conta. A redefinição usa transação para consumir o token, alterar a senha e invalidar os demais links pendentes do usuário.

Links antigos ainda válidos permanecem compatíveis pelo fluxo legado. Os novos envios escolhem APP_WEB_URL ou PANEL_WEB_URL conforme a origem da solicitação. Foram preservados os campos e o desenho dos formulários de recuperação. App usa avisos globais também na recuperação; painel exibe erros em error e mantém apenas um Toaster global, removendo a instância duplicada de AuthenticationLayout.

## E-mail e configuração

O envio sai do backend Fastify do KatuApp; o navegador não recebe credenciais SMTP. A configuração antiga do painel continua apontando para /api/smtp-config do modelo antigo e não configura esse backend. Sua adaptação é um item separado, a confirmar; não foi criada uma segunda fonte de credenciais.

Configurações necessárias, apenas no ambiente do servidor:

- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS e SMTP_FROM, fornecidos pelo provedor de e-mail.
- APP_WEB_URL=https://app.katua.com.br
- PANEL_WEB_URL=https://painel.katua.com.br
- Porta 465 normalmente usa SMTP_SECURE=true; 587 normalmente usa false e STARTTLS. Confirmar com o provedor. Em NODE_ENV=production, conexões não SMTPS exigem STARTTLS e a validação de certificado permanece habilitada.

O arquivo server/.env.example contém somente modelos de configuração e placeholders; não substituir o ambiente da VPS por ele. Aceitação pelo SMTP não comprova chegada na caixa de entrada. A entrega real, remetente autorizado, SPF/DKIM/DMARC e spam dependem do provedor e precisam de conferência no ambiente publicado. Nenhum segredo deve ser colado no chat ou colocado no frontend.

## Banco e publicação futura

Nova tabela AuthEmailToken e migração aditiva server/prisma/migrations/20261019160000_auth_email_tokens/migration.sql. Não altera senhas ou registros operacionais existentes. O SQL da migração foi exercitado no banco descartável de validação.

Antes da atualização da VPS pelo responsável: preservar ambiente e alterações locais, conferir backup, histórico/estado das migrações e compatibilidade do banco existente. O repositório possui um histórico de migrações inicial que não basta para presumir alinhamento com a VPS. Não executar db push, reset ou migrations pendentes sem essa revisão. A tabela deve existir antes de iniciar o backend novo; gerar o Prisma Client e reconstruir backend, painel e App Web. Nenhuma dessas ações foi realizada na VPS nesta entrega.

## Arquivos

KatuApp:

- app/(auth)/login.tsx
- app/(auth)/forgot.tsx
- app/quick-login.tsx
- src/services/authService.ts
- src/contexts/AuthContext.tsx
- server/src/modules/auth/auth-email.service.ts
- server/src/modules/auth/auth.routes.ts
- server/src/modules/auth/auth.controller.ts
- server/src/modules/auth/auth.schemas.ts
- server/src/modules/auth/auth.service.ts
- server/src/config/env.ts
- server/.env.example
- server/prisma/schema.prisma
- server/prisma/migrations/20261019160000_auth_email_tokens/migration.sql
- server/tests/auth-email-unconfigured.test.ts
- server/tests/operational/email-checks.mjs
- server/tests/operational/run-local-validation.mjs
- docs/acesso-por-email.md
- docs/validacao-acesso-email-2026-10-19.json
- docs/rotas-frotas-acompanhamento.md

Katua_Web:

- frontend/src/pages/authentication/Login.jsx
- frontend/src/pages/authentication/ForgotPassword.jsx
- frontend/src/pages/authentication/ResetPassword.jsx
- frontend/src/layouts/AuthenticationLayout.jsx
- frontend/src/services/authService.js
- frontend/src/routes/index.jsx

## Verificações e limites

Passaram: builds de backend e painel, validação do schema Prisma e lint dos arquivos de interface alterados. A execução integrada final teve 24 verificações aprovadas (inclui agrupadores); 18 testes de contrato/SMTP ausente e 4 testes de contrato/renderização web também passaram. Verificação completa de tipos continua com os mesmos oito diagnósticos prévios no app (incluindo backend) e um diagnóstico prévio no backend de destinação; nenhum novo diagnóstico de autenticação.

A validação integrada usa formulários reais do painel e Expo Web, API Fastify/Prisma, PostgreSQL WASM/PGlite e SMTP local descartável que captura mensagens sem envio externo. Inclui recuperação pelo formulário do painel e nova senha, login por link nos dois clientes, expiração, audiência incorreta, reutilização, falha de SMTP, conta inativada, tentativas simultâneas e limite HTTP 429. O teste separado de SMTP ausente usa Fastify inject, sem conexão ao banco.

A execução final e os cenários estão registrados em [validacao-acesso-email-2026-10-19.json](validacao-acesso-email-2026-10-19.json). Tentativas simultâneas no PGlite não equivalem a concorrência nativa do PostgreSQL. Não foi realizado teste em Android/iOS, SMTP de produção ou caixa de entrada real. Os cenários de rotas/frotas também são repetidos pelo executor integrado para detectar regressões.

Reprodução local: seguir as dependências isoladas descritas em validacao-rotas-frotas-2026-10-19.md e executar server/tests/operational/run-local-validation.mjs; KATUA_EMAIL_PANEL_ONLY=1 executa somente a primeira parte de API/e-mail/painel. Nunca apontar esse executor para banco de produção. O SMTP de teste escuta somente em loopback na porta 25259.

## Backlog e continuidade

| Item | Estado | Próximo passo |
| --- | --- | --- |
| Acesso rápido no painel e App Web | validado | Publicação e teste no ambiente real |
| Recuperação sem trocar senha antes da confirmação | validado | Publicação e teste no ambiente real |
| Atualização do banco, código e SMTP na VPS | pendente de publicação | Responsável revisar migrações e ambiente antes de executar |
| Entrega em e-mail real e reputação do remetente | a confirmar | Provedor/configuração e teste após publicação |
| Link abrindo a nova versão Android/iOS | a confirmar | Build instalado e teste em dispositivo |
| Configuração SMTP antiga do painel | confirmado | Fluxo legado aponta a outra API; definir adaptação separada |
| Limites distribuídos e concorrência PostgreSQL nativa | a confirmar | Revisar topologia e executar no ambiente de desenvolvimento adequado |

Resumo de continuidade: layout preservado com seleção de forma de acesso; tokens separados, temporários e de uso único; recuperação conserva senha atual até concluir; mesma infraestrutura SMTP para os dois clientes. Arquivos e testes acima. Próximo passo após os commits: publicação pelo responsável com revisão do banco e configuração de e-mail, seguida de conferência real dos fluxos. VPS não alterada.
