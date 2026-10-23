# Conferência de quantidades e notificações de coleta — 23/10/2026

## Resultado para a operação

Depois de confirmar o recebimento físico, a cooperativa pode informar a quantidade efetivamente recebida por material, na seção **Conferência das quantidades recebidas** dos detalhes da coleta. A seção permanece editável durante a triagem. O sistema mantém o valor originalmente informado em campo e registra cada conferência com responsável, data, motivo, quantidade anterior e quantidade conferida.

Exemplo: o catador informa 50 kg de papel. A cooperativa confirma 40 kg, com justificativa. O histórico mantém os 50 kg; o saldo operacional passa a 40 kg. Não são gerados lotes automaticamente pela conferência. Somente as destinações para estoque criam lotes.

## Entregas e regras

- [x] Conferência disponível nos estados `RECEIVED` e `SORTING`, somente pela cooperativa responsável.
- [x] Campo de quantidade recebida para cada material. Não altera tipo ou unidade.
- [x] Diferença em relação ao valor original exibida antes de salvar; justificativa de pelo menos cinco caracteres obrigatória quando houver alteração.
- [x] Quantidades não negativas, incluindo zero, com até três casas decimais. Litros, unidades e m³ não são convertidos artificialmente em kg.
- [x] Histórico por versão, com valores original/anterior/conferido e identificação do responsável.
- [x] Originais dos materiais existentes preservados pela migração; conferências novas não são inventadas para o histórico anterior.
- [x] Atualização das quantidades normalizadas, saldo da entrada e campos de compatibilidade usados por relatórios e indicadores. Correção dos acumulados relacionados ao catador e gerador.
- [x] Transação com bloqueio da coleta e entradas, e controle de versão para rejeitar uma tela desatualizada. Repetição da mesma versão não aplica o ajuste novamente.
- [x] Não permitir quantidade menor que a já destinada. A cooperativa precisa cancelar/regularizar as destinações afetadas pelos procedimentos existentes antes de reduzir abaixo desse limite.
- [x] Permitir ajuste acima ou igual ao já destinado, preservando lotes e destinações existentes e recalculando somente o saldo restante.
- [x] Impedir conferência antes do recebimento ou depois do encerramento da coleta.
- [x] PDFs novos do painel e comprovante individual do catador incluem as conferências com valores originais/conferidos e justificativa. Arquivos já baixados anteriormente não são reescritos.

## Sino e central de notificações no aplicativo

- [x] Sino na barra superior do aplicativo autenticado, sem sobrepor o conteúdo ou os controles existentes.
- [x] Contador de avisos não lidos e central com data/hora de Fortaleza.
- [x] Avisos de recebimento, início da triagem, conclusão, cancelamento e conferência de quantidades.
- [x] Cada evento gera avisos para usuários vinculados à coleta: catador, motorista vinculado, gerador com acesso e PF solicitante, quando aplicável. Não distribui para toda a equipe da cooperativa.
- [x] Avisos gravados na mesma transação da alteração da coleta; falhas não deixam alteração confirmada sem o respectivo aviso.
- [x] Consulta da etapa atual da coleta a partir do aviso; leitura individual e opção de marcar todas como lidas.
- [x] Paginação e isolamento por usuário autenticado; um usuário não pode marcar o aviso de outro como lido.
- [x] Atualização periódica de 30 segundos quando o aplicativo está ativo e ao retomar o uso. Na central há também atualização manual.
- [x] Cache por usuário da primeira página recebida para consulta sem conexão. Avisos novos são recuperados ao reconectar; marcar leitura depende da API.

São notificações internas do aplicativo, sem envio de e-mail ou push do sistema operacional. O app fechado não exibe um push por esta implementação. Contatos sem conta de usuário vinculada não possuem caixa de notificações; nenhuma credencial é criada automaticamente para eles.

## Dados e API

Migração: `20261023200000_collection_quantity_reviews` no KatuApp/server.

- `Collection`: versão e data da conferência, total original em kg quando ocorre a primeira conferência.
- `CollectionMaterial.reportedQuantity`: quantidade original, preservada nas próximas revisões.
- `CollectionQuantityReview`: histórico imutável pela API, com itens e autoria.
- `InboxNotification`: avisos por usuário, chave de deduplicação e leitura.

Endpoints autenticados:

- `POST /collections/:id/review-quantities`: `{ expectedVersion, reason, items: [{ materialId, quantity }] }`.
- `GET /notifications?limit=30&cursor=...`: avisos do próprio usuário, contador e cursor.
- `PATCH /notifications/:id/read`.
- `POST /notifications/read-all`.

O painel inclui a conferência nos detalhes de **Coletas de resíduos / Lista de coletas**. A primeira confirmação sem divergência também gera registro; repetir uma conferência sem mudar quantidades não cria novas versões.

## Validação

- [x] Migração testada sobre estrutura anterior com material existente: os 50 kg originais foram preservados.
- [x] 21 verificações integradas com PostgreSQL compatível local descartável (PGlite), Fastify real, painel Vite e Expo web exportado em Chromium.
- [x] Cobertura de permissões, justificativa, ajuste 50→40, saldo e acumulados, versão repetida, destinatários vinculados, leitura idempotente/individual, destinações, redução inválida, correção parcial, zero, litros, fechamento e paginação.
- [x] Edição pelo painel e PDF com 50 kg / 40 kg e justificativa.
- [x] App exportado: sino/contador, abertura da central, consulta da coleta, persistência da leitura e consulta dos avisos salvos sem conexão.
- [x] Teste adicional do comprovante do aplicativo, incluindo valores original/conferido e escape do texto do histórico.
- [x] 41 verificações anteriores de regressão do ciclo operacional passaram, abrangendo rotas, delegação, campo, recebimento, triagem, destinações, estoque, O.C., perfis e app web.
- [x] TypeScript do app e API, lint do app, build da API, build Vite e exportação Expo web.

Total: 63 verificações automatizadas aprovadas. Os testes usam dados e credenciais exclusivamente locais, sem acesso à VPS ou envio de comunicações externas. O build Vite mantém o aviso anterior de tamanho de bundle; ele não impede a compilação.

Teste integrado: `Katua_Web/frontend/tests/quantity-review.mjs`. Comprovante do app: `KatuApp/server/tests/quantity-reviews/receipt.cjs`. O teste integrado recebe `KATUA_APP_DIR`, `KATUA_VALIDATION_TOOLS`, `KATUA_CHROMIUM_PATH` e `KATUA_APP_WEB_EXPORT` para apontar aos diretórios locais de validação.

## Atualização da VPS

Publicar banco/API antes do painel e aplicativo, pois as telas novas dependem dos campos e endpoints novos. O responsável pelo ambiente executa:

1. Atualizar KatuApp:

```bash
cd /var/www/katua/app && git pull --ff-only origin main
```

2. Instalar dependências da API, gerar Prisma, aplicar migrações, compilar e reiniciar o serviço:

```bash
cd /var/www/katua/app/server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

3. Atualizar o painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

4. Atualizar o aplicativo web, incluindo os ajustes anteriores do GPS e barra inferior:

```bash
cd /var/www/katua/app && npm ci && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Para aplicativo nativo instalado é necessário distribuir a atualização pelo fluxo adotado para esse aplicativo.

## Backlog após publicação

- [ ] Validar com uma coleta de teste real: informar 50 kg, receber e conferir 40 kg, verificar a justificativa e destinar somente o saldo conferido.
- [ ] Conferir o sino nos usuários de catador e gerador vinculados, abrir o aviso e testar leitura individual.
- [ ] Conferir cache de avisos no aparelho offline e atualização ao reconectar.
- [ ] Validar atualização dos totais e dos PDFs na operação da cooperativa.
- [ ] Conferir o novo cabeçalho em celulares reais, inclusive com fonte ampliada; testes de navegador não substituem essa verificação em campo.
