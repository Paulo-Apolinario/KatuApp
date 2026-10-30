# Ordem cronológica das execuções de rotas fixas — 29/10/2026

A lista em **Coleta de Resíduo → Lista de Coletas → Rotas fixas** agora usa ordem crescente de data e horário programados, independentemente do status. Exemplo: 27/10 → 28/10 → 30/10 → 02/11. Execuções sem data ficam no final; empates de data e horário usam ID crescente para garantir uma ordem estável entre páginas.

A ordenação é feita pela API antes da paginação. Não é uma ordenação somente da página visível. Permanecem os filtros, a separação por execução, a expansão dos pontos e os status. Nenhum registro ou data de coleta é modificado.

Foi removida a prioridade anterior de execuções em campo seguida por data decrescente. A consulta também deixa de buscar e contar separadamente esse grupo. Uma nota na tela informa a ordenação atual.

## Validação

35 cenários de API passaram no banco descartável: 22 de operações em campo/ordenação e 13 regressões de tratamento de pendências. Verificados dias de meses diferentes, três páginas, estados diferentes, empate por ID, datas ausentes no final, filtros, permissões e preservação das coletas realizadas. TypeScript/API, build da API, ESLint do arquivo do painel alterado e build Vite aprovados. O aviso existente de chunk Vite acima de 500 kB permanece.

Não há nova migração ou mudança no App. Sem acesso à VPS. Os testes usam PGlite local; não houve teste de carga de produção.

## Atualização pelo responsável

API:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

Atualizar o navegador com Ctrl+Shift+R.

## Acompanhamento

- [ ] Conferir na VPS as execuções de 27/10, 28/10, 30/10 e 02/11 após a atualização.
