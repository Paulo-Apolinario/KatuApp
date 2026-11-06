# Consulta do catálogo pelo catador

Correção autorizada em 05/11/2026. Somente backend; sem migrações e sem acesso à VPS.

O App já consulta `GET /waste-stock/catalog` ao adicionar um material à coleta. O resolvedor de cooperativa dessa API não contemplava o perfil COLLECTOR, causando a mensagem de falta de permissão.

A API passa a obter o vínculo no cadastro do catador autenticado, usando o usuário do JWT. Catador sem cooperativa ou inativo permanece bloqueado. Informar explicitamente outra cooperativa retorna 403; informar a própria ou omitir o parâmetro consulta o vínculo autenticado.

A consulta mantém os filtros anteriores (`isActive=true` e `status=ACTIVE`) e o mesmo conjunto de campos de catálogo. Não retorna lotes, saldos ou movimentos. As funções administrativas mantêm o bloqueio a perfis diferentes de COOPERATIVE. Nenhuma permissão de cadastro, edição ou movimentação foi liberada ao catador.

Validação: 8 novos cenários com JWT real em Fastify/Prisma e banco PGlite descartável, além dos 12 cenários de integração anteriores. Total: 20 aprovados. Incluem isolamento, filtro de ativos, consulta sem estoque, endpoints administrativos, JWT ausente/inválido, vínculo ausente, inatividade e preservação da consulta da cooperativa. TypeScript e build do backend aprovados. Não houve teste ou gravação em produção.

Reprodução local:

```bash
KATUA_VALIDATION_TOOLS=/caminho/ferramentas node server/tests/collector-web/run.mjs
npm --prefix server run check
npm --prefix server run build
```

Após atualizar e reiniciar o backend pelo responsável pela VPS, basta tentar novamente o botão de catálogo no App. Não é necessário reconstruir App Web ou painel para essa correção.
