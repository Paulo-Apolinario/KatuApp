# Administração da plataforma

O perfil ADMIN possui uma área separada do menu operacional: cadastro inicial/listagem de cooperativas em `/admin/cooperatives` e Analytics global em `/analytics/monitoring`. O cadastro exige ADMIN real e ativo no backend; o formulário não aceita atribuição arbitrária de papéis. Contas criadas por ele são COOPERATIVE, sem herdar privilégios administrativos.

## Provisionamento explícito na VPS

Não há conta padrão, senha no repositório nem criação automática no deploy. Depois de instalar a versão atual da API, aplicar as migrações e gerar Prisma, executar o script `server/scripts/provision-platform-admin.ts` no diretório server, informando `--email`, `--name` e `--password-stdin`. A senha deve chegar por entrada padrão, usando leitura oculta no terminal e um pipe; não é aceita como argumento. Não carregar a senha em arquivos versionados.

O script cria ADMIN com senha armazenada como hash. Se o e-mail já pertencer a ADMIN sem vínculos operacionais, atualiza a senha/estado e revoga sessões anteriores. Se possuir outro papel ou vínculo operacional, recusa sem alterar o cadastro. Não envia e-mail, não cria cooperativa fictícia e não modifica contas de outras organizações. A execução deve ocorrer somente por operador autorizado com acesso à VPS/banco.

## Cadastro inicial de cooperativas

Administrador informa cooperativa, documento, responsável, e-mail de acesso, telefone e senha inicial; município/endereço são opcionais. A conta e a cooperativa são criadas juntas. O evento COOPERATIVE_CREATED guarda autoria administrativa, sem senha. A resposta e a listagem não incluem hash, token ou senha. E-mail/documento duplicado é recusado; em falha de confirmação, consultar a lista antes de repetir. A interface limpa a senha após sucesso e também após erro. Não há envio automático de credenciais por e-mail.

O acesso da cooperativa começa habilitado, mas seu primeiro login permanece desconhecido até autenticação real. Na lista, o administrador pode abrir diretamente o detalhamento da organização no Analytics. Não foram acrescentados exclusão de cooperativa, alteração de papéis pelo navegador ou acesso automático aos dados operacionais no lugar da cooperativa.

## Validação

Testes locais em `server/tests/analytics-monitoring`: provisionamento com hash, recusa de alteração de conta operacional, login ADMIN, Analytics global, cadastro com auditoria, impedimento de elevação de privilégio pelo payload, bloqueio a cooperativas comuns, duplicidade e revogação de sessão após redefinição administrativa. UI em desktop/mobile: formulário, limpeza de senha, listagem e navegação para Analytics, além das regressões de filtros/exportação. Sem banco da VPS, serviços fiscais ou envio de e-mails.
