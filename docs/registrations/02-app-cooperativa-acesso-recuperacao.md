# Etapa 2 — App da Cooperativa, celular e recuperação assistida

## Operação

O App da Cooperativa inclui Cadastro rápido nas listas de geradores e catadores, além de Completar cadastro e acesso nos detalhes. Nome é suficiente para cadastro operacional; geradores mantêm tipo SMALL/LARGE. Documento, e-mail pessoal, telefone e endereço são complementáveis. O rascunho do novo formulário é durável, separado por usuário e tipo; a confirmação do cadastro rápido exige conexão e acontece somente após resposta da API. Alterações cadastrais e envio de acesso também exigem conexão.

O cadastro detalhado anterior de geradores continua com fila offline e identificador idempotente. E-mail, CPF/CNPJ e localização não são mais obrigatórios nesse fluxo de gerador. A fila aceita localização ausente para geradores, valida pares quando enviados e mantém localização obrigatória para PEVs. Dados antigos dos rascunhos recebem os campos novos com valores vazios. Geocodificação opcional não inventa coordenadas a partir apenas da UF ou de uma referência incompleta.

## Identidade e recuperação

Login por senha aceita e-mail ou celular brasileiro com DDD, com ou sem +55 e pontuação. Contratos antigos que enviam a propriedade email continuam aceitos. A consulta utiliza o cadastro vinculado à conta, considera o celular atual e recusa ambiguidade: não escolhe um usuário entre números compartilhados. Não há SMS, WhatsApp ou comprovação de posse de SIM nesta entrega.

A recuperação oferece identificação explícita por EMAIL, PHONE ou CPF. O CPF é validado, precisa estar cadastrado e identificar uma única conta. Um CNPJ alfanumérico não é convertido em CPF por remoção de letras. O painel continua restrito a contas autorizadas do painel; recuperação no painel não localiza contas do aplicativo.

Generator.recoveryEmail e Collector.recoveryEmail são contatos opcionais, não exclusivos, editáveis pela cooperativa do registro. Podem receber o e-mail da cooperativa. Não viram identidade de login e não são usados para disparar recuperação de todos os colaboradores ao buscar um endereço compartilhado. Sem esse contato, a entrega utiliza o e-mail pessoal da conta. O destinatário nunca vem do corpo de uma solicitação pública de recuperação.

POST /registrations/:kind/:id/access-link é autenticado e exclusivo da cooperativa proprietária. kind aceita generators ou collectors. Não aceita destinatário no corpo. Se ainda não existe conta, prepara User com senha aleatória desconhecida, credentialsReady=false, e vínculo ao mesmo cadastro. Sem e-mail pessoal, exige celular válido e inequívoco para o login. Não cria e-mails fictícios. Solicitações com celular ambíguo não habilitam acesso; o cadastro pode ser corrigido e a solicitação repetida.

A senha é definida usando link e senha temporária enviados ao contato salvo. Somente após essa prova a conta fica credentialsReady=true. Até lá, login por senha, link de login e rotas autenticadas permanecem bloqueados. Contas pendentes não entram na cobertura de uso do Analytics. Cadastro operacional e ativação continuam separados.

## Segurança e compatibilidade

User.email passa a aceitar nulo, preservando unicidade dos e-mails preenchidos. credentialsReady recebe true para usuários anteriores: nenhum login existente exige nova ativação por causa da migração. O reset novo pode localizar a conta pelo token, sem exigir e-mail pessoal; os links antigos com e-mail continuam aceitos. A ativação pública legada por e-mail permanece compatível para cadastros sem recuperação assistida; cadastros com recoveryEmail usam o link da cooperativa.

Os tokens persistidos são hashes, têm validade de quinze minutos, uso único e limite de cinco verificações de senha temporária. Solicitações de envio mantêm limite por conta e por origem. O reset incrementa authVersion e revoga sessões antigas e tokens restantes. Alterar o contato de recuperação invalida links anteriores; a seleção do destinatário e emissão do token usam os mesmos locks das edições cadastrais. Falhas SMTP removem o token emitido e não simulam entrega.

RegistrationAccessEvent registra cooperativa, ator, cadastro, ação e horário. Não armazena senha, token ou corpo do e-mail. E-mails de recuperação e links são enviados pelo SMTP de autenticação já utilizado pelo sistema; esta entrega não requer novas variáveis de ambiente. O SMTP existente precisa estar operacional para o envio efetivo.

## Validação e publicação

A migração 20261112180000_phone_login_recovery é incremental. Testes em PGlite descartável aplicam-na sobre o schema anterior com registros existentes, sem acesso a produção. tests/phone-access/run.mjs cobre login legado e por celular, preparação sem e-mail, bloqueio de contas pendentes, recuperação por CPF/celular, destinatário compartilhado, revogação, expiração, limite de tentativas, falhas SMTP, ambiguidade, escopo por cooperativa, fila idempotente de gerador sem localização e metadados do app. E-mails são capturados em transporte falso: nenhum envio real é realizado pelos testes.

Também foram executados testes do cadastro rápido e filiação de catadores, SMTP ausente, verificações TypeScript, builds da API/painel e exportação Expo/PWA. A validação em navegador cobre painel e build real do aplicativo com fixtures sintéticas, celular/tablet e restauração de rascunho após falha/reload.

Publicar primeiro API com prisma:generate e prisma:deploy, depois painel e App Web/PWA. Aplicativos Android/iOS instalados precisam de compilação/distribuição atualizada para receber as telas novas. Não inclui bags misturadas, triagem ou mudança do perfil COLLECTOR; essas são as próximas etapas.
