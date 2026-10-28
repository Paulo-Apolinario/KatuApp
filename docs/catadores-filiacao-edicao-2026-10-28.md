# Catadores — filiação, categoria e edição cadastral

Data: 28/10/2026. Escopo: API e painel, em main nos repositórios KatuApp e Katua_Web.

## Backlog entregue

- [x] Substituir o rótulo Data de associação por Data de Filiação; preservar o campo e as datas já armazenadas.
- [x] Adicionar Número de Inscrição logo depois da data, como texto opcional de até 50 caracteres, preservando zeros, letras e separadores.
- [x] Adicionar Categoria: Fundador, Efetivo, Beneficiado e Contribuinte, com uma categoria por cadastro.
- [x] Manter Autônomo: Sim/Não.
- [x] Exibir apenas Ativo e Inativo no seletor cadastral e nos indicadores da lista de catadores.
- [x] Disponibilizar Editar cadastro em cada linha da lista e a rota `/edit-collector/:id`, reutilizando o formulário completo com dados preenchidos.
- [x] Mostrar inscrição e categoria na identificação da lista e incluí-las na busca, com nomes em português.
- [x] Criar `PATCH /collectors/:id`, restrito à cooperativa proprietária, com atualização parcial e validação explícita dos campos permitidos.
- [x] Permitir preencher dados novos em registros anteriores e limpar campos opcionais durante a edição.
- [x] Preservar identificador, vínculos, produção e documentos. A edição oferece Gerenciar documentos, mantendo os anexos na tela própria já existente.
- [x] Sincronizar nome, e-mail e telefone com o usuário vinculado, dentro da mesma transação. Não alterar senha, perfil de acesso ou cooperativa. E-mail em uso por outro cadastro bloqueia a alteração sem gravação parcial.
- [x] Exibir carregamento, erro com nova tentativa e impedir salvar formulário vazio quando o registro não foi carregado.
- [x] Validar datas reais, categoria, tamanho da inscrição e isolamento entre cooperativas.

## Compatibilidade e dados anteriores

Migração aditiva: `20261028020000_collector_membership_profile`. Acrescenta `registrationNumber` e `membershipCategory` ao catador e o enum das quatro categorias. Não exclui registros, não inventa número ou categoria para cadastros antigos e não altera a data existente em `associationDate`.

Ativo abrange os estados operacionais AVAILABLE e ON_ROUTE já usados pelo sistema. O formulário envia AVAILABLE para Ativo; ao editar catador ON_ROUTE, a API preserva ON_ROUTE. Assim, editar a filiação não encerra a situação em rota. INACTIVE continua representando Inativo. O seletor de cadastro não oferece alteração manual para Em rota. A atualização cadastral não modifica os controles de senha ou permissões da conta.

Campos novos são opcionais para permitir completar o cadastro das pessoas já registradas. Inscrição não recebeu exigência de unicidade, pois essa regra não foi solicitada.

## Validação

17 verificações aprovadas: 11 de API/migração e 6 de interface. Incluem cadastro com as quatro categorias, JSON e multipart, atualização de registro antigo, preservação da produção e dos documentos, sincronização de acesso, conflito de e-mail, limpeza de campos, data inválida, perfis e outra cooperativa, ativação/inativação, formulário preenchido e layout com 390 px de largura. A migração foi aplicada sobre catador existente na base descartável, preservando data e status.

TypeScript, compilação da API, ESLint dos arquivos do painel alterados e build do painel aprovados. Aviso preexistente de bundle do painel maior que 500 kB continua sem impedir o build. Testes locais, sem acesso à VPS nem ensaio em aparelho físico. Detalhes: `docs/validacao-catadores-filiacao-2026-10-28.json`. Instruções reproduzíveis em `server/tests/collector-membership/README.md` no KatuApp.

## Aplicação na VPS

Atualizar KatuApp/main, gerar Prisma Client, executar `npm run prisma:deploy`, verificar/compilar API e reiniciar `katua-api.service`. Atualizar Katua_Web/main e compilar o painel. Não exige exportação Expo do App. Após a atualização, abrir Gestão de Catadores → Listar catadores → Editar cadastro para completar os registros anteriores.
