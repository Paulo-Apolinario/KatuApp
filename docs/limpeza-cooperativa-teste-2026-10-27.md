# Exclusão controlada de cooperativa de teste — 27/10/2026

## Problema e comportamento
A exclusão direta do usuário proprietário pode falhar quando a cooperativa tem históricos protegidos por chaves estrangeiras, como `CollectionWasteDestinationEvent`. Este procedimento manual remove a cooperativa de teste e seus dados operacionais na ordem das dependências. Não altera regras de integridade ou migrações.

## Entregue
- [x] Script `server/scripts/excluir-cooperativa-teste.sql`, executado somente pelo administrador via psql.
- [x] Exigir CNPJ e email de acesso correspondentes a uma única cooperativa com usuário COOPERATIVE. Nenhuma identificação real foi gravada no script.
- [x] Transação única, timeout de espera por lock e interrupção no primeiro erro. Falha desfaz toda a transação; sem desabilitar constraints.
- [x] Bloquear vínculos por FK com registros de outra cooperativa, inclusive os que poderiam sofrer SET NULL ou CASCADE.
- [x] Remover históricos de destinação, OCs, documentos vinculados, incidentes, pedidos/eventos de PEVs, central ambiental, coletas e perfil dos catadores da cooperativa alvo antes da cascata restante.
- [x] Remover usuário proprietário, cooperativa e dados operacionais dependentes, liberando o CNPJ e email corporativo.
- [x] Verificação final de ausência do proprietário, cooperativa e registros com cooperativeId correspondente antes do COMMIT.
- [x] Preservar contas de acesso de colaboradores e PFs; não apagar identidades globais por associação a uma cooperativa.

## Execução manual
A partir da raiz do KatuApp atualizado em main:

```bash
sudo docker exec -i katu_postgres psql -U katu_user -d katu_db -v cnpj=CNPJ_SOMENTE_DIGITOS -v email=EMAIL_DE_ACESSO < server/scripts/excluir-cooperativa-teste.sql
```

Executar somente para dados de teste cuja remoção completa tenha sido autorizada. A linha `EXCLUSAO_CONCLUIDA` aparece somente depois do COMMIT. Se houver erro, não continuar com exclusões avulsas.

## Validação
7 verificações passaram em PostgreSQL em memória (PGlite), usando o DDL integral gerado pelo schema Prisma atual:
1. Email errado preserva todos os registros.
2. CNPJ de outra cooperativa preserva todos os registros.
3. FK entre cooperativas bloqueia a operação sem alterações.
4. Dependência RESTRICT inesperada desfaz inclusive exclusões de auditorias já executadas na transação.
5. Exclusão de alvo com duas coletas, um lote e dependências protegidas; conta do colaborador preservada.
6. Outra cooperativa e seus históricos permanecem idênticos.
7. Reexecução não encontra alvo e não atinge outra cooperativa.

Teste: `server/tests/cooperative-cleanup/maintenance.mjs`. Requer dependência de validação externa `@electric-sql/pglite` via `KATUA_VALIDATION_TOOLS`; não lê DATABASE_URL nem conecta à VPS. Prisma CLI local gera o DDL sem conexão a banco real.

## Limites e backlog
- [ ] Conferir o resultado da execução pelo administrador na VPS.
- Arquivos físicos de anexos e avatares não são removidos por este procedimento SQL; sua limpeza é separada.
- Não é migração nem rotina automática. Não exige build ou reinício da API/painel/App.
