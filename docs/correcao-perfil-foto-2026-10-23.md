# Correção do perfil pessoal e foto — 23/10/2026

## Problema observado

As imagens enviadas mostram o nome preenchido em Configuração de perfil, mas a API responde “Informe o nome completo”. O painel enviava `displayName` e `profileImage` como multipart/form-data; o backend lia apenas JSON e não processava os campos ou a foto.

Havia também divergência entre os dados locais: essa tela gravava chaves antigas (`user` e `@katu:user`), enquanto a autenticação e o cabeçalho utilizavam `auth_user` e o contexto autenticado. O cabeçalho procurava a imagem num endereço de upload que não correspondia a um armazenamento implementado para o perfil.

## Alterações

- [x] Aceitar nome e imagem juntos no PATCH autenticado `/auth/profile`, processando o multipart corretamente.
- [x] Preservar compatibilidade com o JSON utilizado pelo aplicativo para alterar somente o nome.
- [x] Validar nome entre 3 e 150 caracteres.
- [x] Aceitar JPG, PNG e WEBP com até 3 MB, verificando a assinatura do arquivo no backend. Não aceitar um PDF apenas porque o nome ou MIME aparentam uma imagem.
- [x] Armazenar a imagem com nome aleatório e vínculo ao usuário autenticado. O e-mail continua sem alteração por essa operação.
- [x] Manter a foto existente quando o usuário altera somente o nome.
- [x] Remover a versão anterior da foto após a substituição bem-sucedida. Descartar a nova imagem quando a gravação do perfil falhar.
- [x] Servir a foto por `/auth/profile/avatar`, com autenticação, acesso ao próprio perfil, `private, no-store` e `nosniff`. Ela não é publicada na pasta de uploads abertos.
- [x] Carregar a imagem no painel como blob autenticado e liberar os URLs temporários ao substituir/sair da tela.
- [x] Atualizar `auth_user` e o contexto de autenticação após salvar; refletir nome e imagem no cabeçalho imediatamente e depois de recarregar.
- [x] Permitir cancelar uma nova seleção de imagem e preservar mensagens de validação em caso de arquivo inválido.
- [x] Separar o nome pessoal do responsável do nome da cooperativa. Alterar o nome completo no perfil não renomeia a empresa; os dados da cooperativa continuam em Configurações da empresa.

## Banco e armazenamento

Migração: `20261023210000_profile_avatar`.

Novo campo opcional `User.avatarFile`. Os usuários existentes continuam válidos e sem foto obrigatória. A API retorna `avatarUrl` somente quando existe uma foto vinculada; não retorna o caminho físico do armazenamento.

Diretório padrão, relativo ao diretório de execução da API: `storage/profiles`. No deploy habitual, `/var/www/katua/app/server/storage/profiles`. A variável opcional `PROFILE_STORAGE_DIR` pode definir outro local. A pasta precisa ser gravável pelo usuário do serviço `katua-api.service` e persistir entre builds. Os arquivos não ficam em `dist`.

A interface e o servidor limitam a seleção/envio a JPG, PNG e WEBP até 3 MB. A validação por assinatura não é uma conversão ou redimensionamento da imagem.

## Validação

- [x] 12 verificações integradas com banco local descartável, Fastify real, Vite e Chromium.
- [x] Migração da estrutura anterior; compatibilidade JSON; nome + imagem multipart; persistência de nome/e-mail/foto; imagem autenticada e isolamento entre usuários.
- [x] Arquivo incompatível e tamanho superior a 3 MB rejeitados sem alterar o nome ou perder a foto salva.
- [x] Substituição remove a foto anterior; nome vazio é recusado; tentativa de mudar e-mail por esse endpoint não muda o cadastro.
- [x] Painel salva nome e imagem, atualiza `auth_user`/cabeçalho e preserva os dados depois de recarregar.
- [x] Arquivo inválido no painel e cancelamento da seleção.
- [x] TypeScript e build da API.
- [x] Build Vite e lint direcionado aos arquivos alterados, sem erros. Permanece o aviso de Fast Refresh do contexto que também exporta seu hook; o build mantém o aviso já existente sobre tamanho de bundle.

Teste integrado: `Katua_Web/frontend/tests/profile-upgrade.mjs`. Não usa credenciais, banco ou armazenamento da VPS. As imagens do teste são arquivos pequenos demonstrativos, sem dados de usuários reais.

## Atualização da VPS

Atualizar banco/API antes do painel:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Se for necessário provisionar a pasta padrão para o usuário do serviço:

```bash
katua_api_user="$(systemctl show katua-api.service -p User --value)" && katua_api_user="${katua_api_user:-root}" && katua_api_group="$(id -gn "$katua_api_user")" && sudo install -d -m 0750 -o "$katua_api_user" -g "$katua_api_group" /var/www/katua/app/server/storage/profiles
```

Atualizar o painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

Não há alteração no código Expo nesta correção. Se as atualizações anteriores de GPS, navegação e notificações ainda não foram exportadas na VPS, continua necessário atualizar o app web conforme o documento da atualização anterior.

## Backlog de conferência em produção

- [ ] Salvar nome e foto no perfil do responsável, recarregar e conferir a imagem no cabeçalho.
- [ ] Alterar somente o nome e conferir a preservação da foto.
- [ ] Confirmar que o nome da cooperativa permanece correto em Configurações da empresa.
- [ ] Conferir a permissão e persistência do diretório de imagens do serviço na VPS.
