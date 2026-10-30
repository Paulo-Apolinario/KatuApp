# Ações do estoque, unidades e códigos automáticos — 30/10/2026

- O botão Movimentar lote fica abaixo da data de recebimento, em uma coluna com espaçamento próprio.
- As ações do material expandido ficam em uma única barra: Destinar, lote(s), destinações/documentos e histórico da entrada. A barra permite quebra de linha no celular e evita botões repetidos dentro dos detalhes.
- A unidade LITER aparece como Litro (L) no catálogo; seu identificador técnico e os dados salvos não mudam.
- O código interno do material é gerado pelo servidor no formato MAT-AAAAMMDD-identificador quando não informado. Cadastros antigos sem código recebem identificação ao serem salvos, classificados ou usados para adicionar um lote manual.
- O lote manual recebe código LOT-AAAAMMDD-identificador quando o código não é informado. Lotes originados de destinação continuam usando a geração automática já existente.
- Códigos existentes são preservados; clientes antigos que fornecem códigos continuam compatíveis. Não há renumeração em massa. Restrições de unicidade existentes no banco permanecem ativas.
- Os formulários mostram que o código será gerado ao salvar; não exigem sua digitação. O cadastro e o lote possuem identificadores distintos.

Validação: TypeScript e build da API aprovados; ESLint dos arquivos alterados do painel sem erros/avisos e build Vite aprovado (permanece o aviso existente de tamanho do pacote). Foram aprovados 26 grupos de testes da API (22 de base e quatro grupos de códigos) e seis grupos no navegador com API real e banco PGlite descartável. Verificaram geração ao omitir código ou enviar vazio, preservação dos códigos, cadastro antigo, criações simultâneas, classificação durante destinação, cadastro manual no painel, Litro (L), espaçamento da data e alinhamento medido dos botões, além de tela de 390 px e ausência de erros JavaScript. Capturas renderizadas foram inspecionadas.

Reprodução:

```bash
cd server
KATUA_VALIDATION_TOOLS=/caminho/ferramentas STOCK_CODES=1 node tests/field-operations/run.mjs
KATUA_VALIDATION_TOOLS=/caminho/ferramentas KATUA_PANEL_FRONTEND=/caminho/painel/frontend STOCK_CODES=1 STOCK_CODES_UI=1 node tests/field-operations/run.mjs
```

Não há nova migração ou alteração no App. Esta entrega utiliza o schema da entrega anterior. Não foi feito acesso à VPS.

API:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```
