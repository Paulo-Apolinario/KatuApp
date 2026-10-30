# Configurações do sistema — 21/10/2026

## Escopo autorizado

Modernização das configurações da cooperativa, SMTP próprio, central de pendências, preferências e rastreabilidade. A troca de senha funciona sem senha antiga, mediante confirmação enviada ao e-mail já cadastrado da conta. A implantação na VPS é realizada pelo responsável pelo ambiente; MTR permanece na etapa pausada.

## Telas entregues

| Tela | Resultado |
| --- | --- |
| Dados da cooperativa | Nome de exibição, razão social, CNPJ, contato institucional, responsável/cargo, site, endereço, sede por coordenadas ou clique no mapa, logotipo com prévia. Dados comuns atualizam o cadastro existente da cooperativa. |
| Minha conta e segurança | Nome/e-mail da conta conectada, solicitação de código por e-mail e definição de nova senha sem exigir senha antiga. |
| E-mails e SMTP | Configuração individual por cooperativa, credencial protegida, remetente, endereço para respostas, verificação de conexão, teste enviado à própria conta e últimos 50 envios. |
| Central de Pendências | Condições reais da operação, prioridade, categoria, busca, situação, leitura, responsável interno, adiamento de 24 horas e links para agir. |
| Preferências operacionais | Dias/horários, antecedência dos documentos, tolerância de atraso de coletas, prazo de saldo a destinar, categorias/destinatários dos avisos, envio após detecção ou resumo diário. |
| Histórico de alterações | Autor, seção/ação, nomes dos campos e data, com paginação. Nenhuma senha ou código é registrado no histórico. |

Visual integrado ao padrão de PEVs, resíduos e relatórios, em português, com estados de carregamento/erro, confirmação de salvamento e layout móvel. As rotas antigas `/settings`, `/smtp-config` e `/system-alerts` continuam válidas. Novas rotas: `/account-security`, `/operational-preferences` e `/settings-history`.

O logotipo aceita PNG/JPEG de até 250 KB; é utilizado no menu e na identificação dos relatórios PDF. O ícone padrão do produto continua disponível. Foram removidas as consultas antigas do painel às rotas `/api/settings`, `/api/smtp-config` e `/api/system-alert`, que não tinham implementação correspondente na API Fastify utilizada pela VPS. Não se utiliza o backend legado que acompanha o template web.

A validação desta tela aceita CNPJ numérico e alfanumérico, verificando os dígitos segundo o manual da Receita Federal: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf. Não é uma consulta cadastral à Receita e não comprova situação ativa. A revisão de validadores em outros módulos é uma evolução separada.

## Troca de senha sem senha antiga

1. O usuário autenticado solicita o código em Minha conta e segurança.
2. A API escolhe o destinatário pelo cadastro da conta; o formulário não pode indicar outro e-mail. Alterar o e-mail institucional da cooperativa não altera o e-mail de autenticação.
3. O código de seis dígitos expira em dez minutos, permite até cinco tentativas e só pode ser consumido uma vez. Há limite de três solicitações em quinze minutos por conta; a criação é serializada no banco para evitar ultrapassar o limite por chamadas concorrentes.
4. O usuário informa o código, nova senha com 12 a 128 caracteres e confirmação na tela. A senha é armazenada com o hash utilizado pela autenticação existente.
5. Após concluir, são invalidados os tokens de recuperação/acesso por e-mail ainda pendentes e incrementada a versão de autenticação da conta. Sessões anteriores deixam de ser aceitas; o painel solicita novo login. Login convencional e acesso rápido emitem a nova versão.

O código é armazenado por HMAC, vinculado à solicitação e protegido pelo segredo da API. Não aparece na resposta da API nem na auditoria. A confirmação utiliza exclusivamente o SMTP geral do KATUÁ, já usado pelo acesso rápido. Se ele estiver indisponível, a tela informa a necessidade de configuração; não remove a confirmação para contornar a falha.

Os demais fluxos existentes de redefinição/troca também passam a revogar sessões anteriores. Tokens emitidos antes desta entrega continuam aceitos enquanto a versão da conta for zero, até uma alteração de senha ou expiração normal. `server/src/server.ts` não foi modificado.

## SMTP e proteção das credenciais

- Cada cooperativa possui sua configuração, independente das demais. A API determina o escopo pelo usuário ativo; IDs enviados pelo cliente não escolhem outra cooperativa.
- Portas admitidas: 465 com TLS; 587/2525 com STARTTLS obrigatório, validação do certificado e tempos máximos de conexão.
- Host resolve apenas para IPv4 público e o endereço é fixado na conexão, com validação TLS do nome original. Destinos locais, privados e de metadados são bloqueados. Servidores exclusivamente IPv6 não são suportados nesta entrega.
- Autenticação por usuário/credencial SMTP. Contas que exigem OAuth devem usar uma credencial SMTP permitida pelo provedor ou aguardar integração OAuth específica. Nenhum provedor tem entrega garantida pelo sistema.
- A senha é cifrada com AES-256-GCM, vetor aleatório e associação à cooperativa. A chave fica apenas no ambiente da API. Respostas informam somente se existe credencial; campo vazio preserva a senha atual.
- Testar conexão verifica autenticação/conexão. Enviar e-mail de teste verifica o aceite da mensagem, destinada apenas à própria conta conectada. Testes têm limite de três em quinze minutos por cooperativa.
- Remetente, domínio, SPF/DKIM/DMARC, permissão SMTP e credenciais são fornecidos/configurados com o provedor da cooperativa. O aceite SMTP não garante recebimento na caixa de entrada.
- Os envios operacionais desta entrega são avisos da central e seus resumos. Recuperação/acesso rápido e feedback de suporte mantêm os canais gerais existentes; não são migrados silenciosamente para o SMTP de uma organização.

Referência técnica para transporte e verificação: https://nodemailer.com/smtp.

## Critérios das pendências

| Categoria | Condição utilizada |
| --- | --- |
| Coletas | Pendente/em andamento, com programação de agendamento ou da rota vencida além da tolerância configurada. Não se inventa data para coleta sem programação. |
| Resíduos | Entrada com saldo positivo, data de coleta além do prazo configurado e coleta não cancelada. O botão abre a entrada para destinação. |
| Documentos | Documento de veículo vencido ou com vencimento dentro da antecedência configurada. |
| Manutenções | Último registro do veículo com próxima manutenção vencida ou agendamento pendente/vencido. |
| PEVs | Retirada solicitada no cadastro (`needsPickup`). Não há estimativa de lotação por sensor. |
| E-mails | Envios com falha, confirmação desconhecida ou aceite parcial. |
| Cadastro | Campos institucionais essenciais ausentes, com acesso ao cadastro para completar. |

O aviso é resolvido automaticamente após a correção da origem. Marcar como lido e adiar não resolvem a condição. O responsável é uma indicação interna em texto; não cria usuário nem dispara mensagem individual. Uma condição resolvida que reaparece inicia nova ocorrência.

As condições são atualizadas ao consultar a central e pelo processamento periódico. Consulta de cada origem limitada a 1.001 registros; ao atingir o limite, a atualização informa que pode estar parcial e evita resolver pendências antigas por ausência no recorte. A listagem mostra até 1.000 alertas e informa truncamento quando aplicável. Evolução para grandes volumes está no backlog.

## Fila e frequência dos avisos

O processamento roda na própria API a cada minuto, sem PM2, cron externo ou serviço adicional. Depende de `katua-api.service` ativo e banco/migração disponíveis. Evita sobreposição no mesmo processo e usa chaves únicas/atualização condicional no banco para não processar o mesmo envio simultaneamente em instâncias diferentes.

- Envio após detecção: agenda até 20 novos avisos por cooperativa em um ciclo e continua nos ciclos seguintes, sem ficar preso aos avisos já enviados.
- Resumo diário: uma mensagem por cooperativa e dia, após a hora escolhida, no fuso do Ceará. Não há envio retroativo de todos os dias em que a API ficou desligada. Inclui até 500 pendências, com aviso explícito caso haja mais.
- Até cinco destinatários e categorias selecionadas. Avisos adiados ficam fora da seleção até o prazo terminar. A leitura não equivale a resolução e a pendência pode continuar no resumo.
- A fila envia até 20 mensagens por ciclo global, em ordem de criação. As credenciais e a ativação atuais são verificadas antes do envio. Conta inativa/avisos desativados podem cancelar mensagens pendentes.
- Mudanças nas preferências cancelam avisos ainda pendentes com os critérios anteriores. Não reenviam mensagens já aceitas. Um aviso cancelado não é reativado retroativamente; novas ocorrências/resumos seguintes seguem as novas preferências.
- Histórico distingue fila, envio em andamento, aceite, falha, aceite parcial, confirmação desconhecida e cancelamento. Falhas elegíveis podem ser recolocadas na fila pelo usuário, até cinco tentativas no total. Aceite parcial ou situação desconhecida exigem conferência e não recebem reenvio automático.
- Envios interrompidos durante o processamento por mais de dez minutos ficam como confirmação desconhecida; não se presume que o destinatário deixou de receber.

Os horários de funcionamento cadastrados são informativos: não bloqueiam operações e não representam plantão ou escala de trabalho. Os prazos de alerta são aplicados efetivamente. O resumo diário usa seu próprio horário configurado.

## Migração e configuração na VPS

Nova migração aditiva: `20261021160000_cooperative_settings`.

Ela adiciona `User.authVersion`, `AuthEmailToken.attempts` e cria `CooperativeSettings`, `SettingEvent`, `SystemAlert` e `MailDelivery`. Não apaga registros operacionais e não modifica tabelas de MTR.

Ordem de atualização:

1. Atualizar `KatuApp/main`, preservando `.env`, arquivos privados, uploads e ajustes locais da VPS.
2. Em `/var/www/katua/app/server`: `npm ci --include=dev`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run check` e `npm run build`.
3. Configurar **uma única vez** `SETTINGS_ENCRYPTION_KEY` no `.env` privado da API. Gerar uma chave de 32 bytes em base64 com `openssl rand -base64 32`. Não enviar a chave para o GitHub ou para o frontend. Se já existir uma chave em uso, preservá-la.
4. Guardar essa chave junto ao procedimento privado de recuperação do banco. Gerar outra chave torna as credenciais SMTP antigas ilegíveis até serem cadastradas novamente; não se deve regenerar a chave em cada atualização.
5. Conferir o SMTP geral da API (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) para o envio dos códigos de segurança. Manter as URLs e demais variáveis existentes.
6. Reiniciar `sudo systemctl restart katua-api.service` e conferir `sudo systemctl is-active katua-api.service`.
7. Atualizar `Katua_Web/main`, instalar dependências e compilar o painel em `/var/www/katua/frontend/frontend`.
8. Cadastrar e testar o SMTP da cooperativa antes de ativar seus avisos por e-mail. Conferir a caixa de entrada e spam do teste. Validar a troca de senha com a conta real e depois entrar novamente.

Aplicar a migração antes de iniciar a API nova: a autenticação passa a ler `authVersion`. Não usar `db push`, `migrate reset` ou marcar a migração como aplicada sem executá-la. A ausência da chave de criptografia não impede o cadastro institucional, mas impede salvar uma nova credencial SMTP.

## Validação e limites

- TypeScript e build de produção da API; lint das novas telas/componentes e build do painel.
- Quatro testes de segurança: CNPJ numérico/alfanumérico, bloqueios de endereços SMTP, chave/cifras e rejeição de entradas indevidas.
- API Fastify/Prisma real sobre banco PGlite descartável com migração incremental. DNS e transporte SMTP simulados; não foram enviados e-mails externos e não houve acesso ao banco da VPS.
- Treze cenários de integração aprovados: persistência/versão, isolamento por cooperativa, criptografia/segredo, conexão/teste/bloqueio privado, preferências/fila/deduplicação, alertas e resolução real, falha/nova tentativa/auditoria, seis telas desktop, salvamento pelo painel, seis telas móveis, recuperação de falha de API, processamento após o primeiro lote e senha por código com tentativas/uso único/revogação.
- Regressão dos relatórios existentes: 12 cenários aprovados novamente, incluindo API, isolamento, gráficos, downloads Excel/PDF e layout móvel.
- Capturas inspecionadas em desktop e celular. O teste móvel confere ausência de transbordamento horizontal da página; tabelas extensas possuem rolagem interna.
- O build do painel mantém o aviso de bundle acima de 500 kB; não impede a compilação. Otimizações adicionais de carregamento continuam no backlog.

Testes reproduzíveis: `server/tests/settings/security.test.ts`, `server/tests/settings/local-server.ts` e `frontend/tests/settings-browser.mjs`. O runner usa ferramentas locais externas de PGlite/Chromium/Playwright e as variáveis descritas no teste de relatórios, com banco isolado em 127.0.0.1:54329 e portas 3339/5179. A fixture recusa outro destino de banco. As rotas `__validation` só existem na fixture descartável, nunca no código da aplicação. Credenciais/códigos demonstrativos são temporários e não são incluídos nos resultados publicados.

Resultado automatizado: `docs/validacao-configuracoes-2026-10-21.json`.

## Backlog

### Concluído

- [x] Cadastro institucional integrado, endereço, mapa e identidade visual.
- [x] Configurações separadas por cooperativa e controle de versão.
- [x] Troca de senha sem senha antiga, confirmada por e-mail, com revogação de sessões.
- [x] SMTP próprio com criptografia, testes e proteção de destinos de rede.
- [x] Central de pendências com condições reais, ações e resolução pela origem.
- [x] Preferências de funcionamento, critérios, destinatários e frequência.
- [x] Fila persistente, deduplicação, histórico de envios e nova tentativa explícita.
- [x] Auditoria sem senhas/códigos e revisão visual responsiva.

### Próximas evoluções

- [ ] Validar configuração real de cada provedor e seu domínio na VPS, inclusive entrega/inbox/spam.
- [ ] OAuth específico para provedores que não oferecem credenciais SMTP de aplicativo.
- [ ] Paginação e processamento por lotes das origens de alertas para volumes superiores aos limites informados.
- [ ] Política de retenção/arquivamento de histórico e mensagens, conforme o volume e a operação acordados.
- [ ] Responsáveis por seleção de usuários/perfis, quando houver múltiplos gestores por cooperativa.
- [ ] Integrar horários de funcionamento a regras de agendamento somente após definir exceções e plantões com a operação.
- [ ] Unificar validação de CNPJ alfanumérico nos demais módulos, incluindo integrações futuras.
- [ ] Métricas de entrega/bounce por integração com o provedor; aceite SMTP não é confirmação de leitura ou recebimento.

Nenhuma implantação da VPS foi executada nesta entrega. MTR permanece pausada conforme solicitado.
