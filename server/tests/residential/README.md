# Gerador residencial

Consulte `docs/gerador-residencial-2026-10-28.md` na raiz.

- `api.ts`: extensão do banco descartável de field-operations. Migração, perfil, idempotência, autorização, cancelamento e concorrência reais.
- `unit.cjs`: código real dos campos e serviço de envio com armazenamento/transporte controlados.
- `browser.mjs`: export Expo com API local real. Não encaminha requisições à VPS; simula perda da resposta após criação e valida retomada após reload.

Resultados e screenshots são gravados no diretório `KATUA_VALIDATION_TOOLS`, sem credenciais de produção. O roteiro de celular físico continua separado e pendente.
