# Etapa 1 — Cadastro operacional rápido

Implementação no painel da cooperativa, com uso também pelo navegador do tablet/celular. Geradores e catadores podem ser cadastrados sem e-mail, CPF/CNPJ, telefone ou endereço. Para geradores, o tipo SMALL/LARGE continua obrigatório; não identifica pessoa física sem documento. Sem documento, a classificação residencial/pequeno negócio continua pendente.

A migração 20261112150000_quick_operational_registration remove apenas NOT NULL de Generator.email e Collector.email. Mantém índices únicos, IDs, vínculos, quantidades, documentos e usuários existentes. User.email continua obrigatório e único. Não cria e-mails fictícios nem contas de acesso para cumprir o cadastro.

POST /generators e POST /collectors aceitam cadastro operacional mínimo e derivam a cooperativa do usuário autenticado. Continuam exclusivos da cooperativa. PATCH permite completar informações no mesmo ID, preservando o histórico. O e-mail de um gerador sem usuário vinculado pode ser informado posteriormente; o e-mail de gerador com login vinculado não é alterado por essa edição. A correção sincronizada de e-mail de catador com acesso mantém o comportamento existente. Valores vazios de e-mail e documento do gerador não apagam informações já preenchidas.

Quando fornecidos, e-mail e documentos devem ser válidos. CPF de catador também confere dígitos verificadores. E-mail pessoal não pode ser reutilizado entre novos cadastros de gerador, catador e usuário: recuperação compartilhada terá um campo próprio na etapa de acesso. Não há consolidação automática de duplicidades históricas.

As respostas principais de cadastro/lista/detalhe/edição incluem registrationStatus, missingRegistrationFields e hasOnlineAccess. A completude é calculada (documento válido, e-mail, telefone e endereço), independente do status operacional e da ativação de acesso. Essas pendências são informativas e não impedem vincular o cadastro a uma operação. A busca opcional de coordenadas na criação tem prazo e, se indisponível, não impede o cadastro.

Escopo desta entrega: cadastro rápido e complementação no painel. Login por celular, recuperação assistida, bags misturadas, triagem e rodízio no App do Catador pertencem às próximas etapas e não estão ativados por esta migração. A interface nativa de cadastro mantém o fluxo anterior nesta etapa.

Validação: tests/quick-registration/run.mjs usa banco descartável local e aplica a migração sobre o schema anterior com cadastros preexistentes. Testa nomes mínimos, vários e-mails/documentos nulos, validações, conclusão sem ativação, preservação de e-mail/documento, acesso vinculado, duplicidades entre perfis, isolamento por cooperativa e uso em agendamento/coleta. Regressão do cadastro/filiação de catadores e validação CPF/CNPJ compartilhada também foram executadas. Nunca aponta ao banco de produção.

Atualizar a API com prisma:generate e prisma:deploy antes de publicar o painel. Não há nova variável de ambiente ou dependência.
