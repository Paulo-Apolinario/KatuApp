# Geradores cadastrados por CPF/CNPJ - 30/10/2026

## Regra do cadastro

Dentro do tipo SMALL (Pequeno Gerador), CPF válido identifica Gerador residencial cadastrado; CNPJ válido identifica Pequeno gerador. Os dois conservam o perfil GENERATOR_SMALL e o mesmo fluxo de acesso já existente. Não é criado um perfil PF para o residencial cadastrado. O residencial independente do App, sua PersonProfile e suas telas permanecem intactos.

A classificação é derivada do documento validado e do tipo: REGISTERED_RESIDENTIAL, SMALL_BUSINESS, PENDING_DOCUMENT ou LARGE. O servidor calcula esses campos; não confia em classificação enviada pelo cliente. Não é usada suposição por nome, e-mail ou razão social.

## Persistência e validação

Nova coluna nullable Generator.documentNumber, armazenada sem máscara, em maiúsculas. Índice único composto por cooperativeId e documentNumber impede duplicação na mesma cooperativa. O mesmo documento pode constar em outra cooperativa e no perfil PF independente: os cadastros não são mesclados e não compartilham permissões. Mantém-se a regra anterior de unicidade de e-mail. O novo documento não é acrescentado às respostas operacionais de coleta, feedback ou consultas ambientais; os dados cadastrais completos continuam restritos aos acessos próprios.

CPF: formato de 11 dígitos e validação dos dois dígitos verificadores. CNPJ: 14 posições, com doze caracteres de identificação e dois dígitos verificadores, aceitando numérico e alfanumérico. Validação alfanumérica segue o manual oficial da Receita Federal: módulo 11, pesos de 2 a 9 e valor ASCII menos 48. Repetições e caracteres indevidos são rejeitados. Essa validação não confirma situação cadastral nem titularidade na Receita.

Referência técnica: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf

## Telas e compatibilidade

Campo CPF/CNPJ em Dados do Gerador no cadastro e na edição, com máscara e prévia da classificação. A lista mostra a classificação e o documento formatado, pesquisa CPF/CNPJ e permite filtrar por classificação. Grande gerador mantém documento opcional; se informado, deve ser CNPJ.

Novos cadastros SMALL no Painel exigem o documento. Registros anteriores sem documento podem ter outros dados editados e aparecem como documento pendente até complementação. Clientes antigos, incluindo o cadastro existente na Cooperativa do App, podem continuar omitindo o campo na API; o registro fica pendente de classificação. Não foi removida essa compatibilidade. Um documento informado deve ser válido; vazio ou null explícitos são rejeitados. Documento existente não é apagado por omissão na atualização.

A edição de CPF/CNPJ mantém o ID, coletas, documentos anexados e produção. Não altera o papel do usuário entre CPF e CNPJ: ambos continuam SMALL/GENERATOR_SMALL. Não houve mudança em arquivos do App nem na autenticação/ativação já existente.

## Migração e atualização

Aplicar 20261030010000_generator_document antes de iniciar a nova API. É uma migração aditiva: documentos antigos ficam null; não há preenchimento ou reclassificação em massa. Atualizar API primeiro, depois o Painel. Não requer nova versão do App.

API: npm ci --include=dev; npm run prisma:generate; npm run prisma:deploy; npm run check; npm run build; reiniciar katua-api.service.

Painel: npm ci --include=dev; VITE_API_BASE_URL=https://vps.katua.com.br npm run build.

## Validação

78 verificações de API, incluindo regressões de campo, residencial, pendências e comunicação; 8 verificações de interface com API real local; 3 grupos de validação unitária entre Painel e servidor. Migração sobre cadastro antigo, correção de documento com histórico preservado, unicidade, isolamento entre cooperativas, compatibilidade legada, autenticação de ambos pelo mesmo perfil, CPF independente preservado e disputa por documento duplicado. Máscaras e erros testados em telas desktop e 390px.

Testes usam banco descartável e dados demonstrativos; mapas são controlados e chamadas externas bloqueadas no teste de interface. Não houve acesso à VPS. Não é ensaio de carga nem homologação em dispositivo físico. Mensagens Prisma de unicidade nos logs dos testes são provocadas para validar o bloqueio e o rollback; não indicam falha da suíte.
