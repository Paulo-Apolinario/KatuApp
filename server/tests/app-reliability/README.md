# App: confiabilidade e históricos

Leia `docs/app-confiabilidade-2026-10-28.md` na raiz do repositório.

- `api.ts`: extensão opt-in do fixture de `field-operations`; PostgreSQL descartável, migração de índices, paginação, autorização e idempotência reais.
- `offline.cjs`: executa os repositórios web e serviços reais com armazenamento persistente em memória; reinicia o grafo de módulos e controla o transporte. GPS é simulado, sem sensores físicos.
- `browser.mjs`: usa o export Expo, Chromium a 390px e respostas controladas. Nunca encaminha chamadas à VPS.

O relatório não substitui o roteiro de Android/iPhone físico.
