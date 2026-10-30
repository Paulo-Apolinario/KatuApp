# Visual das notificações e sino nos cabeçalhos — 24/10/2026

## Solicitação

As imagens mostravam uma faixa branca global com “KATUÁ” e sino, acima dos cabeçalhos operacionais, e uma central com ações textuais pouco organizadas. A solicitação foi retirar a faixa, aproximar o sino do recarregamento e melhorar o visual da central.

## Entregas

- [x] Remover a faixa branca global. O acompanhamento do contador permanece ativo em um contexto sem interface própria.
- [x] Transformar o sino em botão compacto de 44×44, com contador de não lidas e contraste para os cabeçalhos verdes.
- [x] Colocar o sino ao lado de recarregar em Dados, Coletas delegadas e Mapa do catador, e no Mapa da cooperativa.
- [x] Integrar o acesso aos cabeçalhos principais de catador, motorista, pessoa física, gerador e cooperativa, e aos comprovantes do catador.
- [x] Renovar a central com cabeçalho em verde, voltar/atualizar por ícones identificados, texto de orientação e resumo de leitura.
- [x] Limitar a largura do conteúdo no desktop, com adaptação para celular e tipografia ajustada para telas de 320 px.
- [x] Criar cartões com categoria, ícone, data/hora e destaque de aviso não lido.
- [x] Apresentar quantidades informadas/conferidas em blocos comparativos, com justificativa e responsável.
- [x] Incluir filtros Todas / Não lidas e ação Marcar todas como lidas. O filtro considera os avisos carregados; a paginação permite consultar os demais.
- [x] Substituir a mensagem vazia simples por um cartão com ícone e orientação; distinguir indisponibilidade de conexão de uma central sem avisos.
- [x] Apresentar a etapa atual da coleta numa janela de detalhes, com referência, status e fechamento. A janela permite rolagem quando necessário.
- [x] Preservar o conteúdo durante a animação de fechamento da janela, evitando mostrar dados vazios na transição.
- [x] Manter atualização periódica, paginação, cache por usuário, leitura persistente e consulta dos avisos salvos sem conexão.

Não há novos dados, migrações ou endpoints nesta atualização. O contexto compartilha o contador entre os botões; cada sino não cria seu próprio temporizador de consulta.

## Validação

- [x] 16 verificações da interface Expo web exportada em Chromium com sessão/API controladas: retirada da faixa, posição junto do recarregamento, central, comparação de quantidade, filtros, detalhes, leitura, indisponibilidade de rede, largura de 320 px, central vazia e acesso pelos cabeçalhos principais.
- [x] 21 verificações da integração anterior com API real, banco local descartável PGlite, painel Vite e app exportado: conferência, saldos, permissões, avisos, leitura, PDFs e cache offline.
- [x] Total de 37 verificações aprovadas, sem acesso ao ambiente da VPS.
- [x] TypeScript, lint do aplicativo e exportação web.
- [x] Capturas de celular e desktop inspecionadas para a central com avisos e sem avisos.

Teste visual: `KatuApp/tests/inbox/design-browser.mjs`. Usa `KATUA_APP_WEB_EXPORT`, `KATUA_VALIDATION_TOOLS` e `KATUA_CHROMIUM_PATH` para os diretórios locais de validação.

O teste `Katua_Web/frontend/tests/quantity-review.mjs` foi adaptado para fechar a nova janela antes de clicar em atualizar. Essa é a única alteração no código desse repositório além deste documento; o produto painel não mudou.

## Atualização do aplicativo web na VPS

```bash
cd /var/www/katua/app && git pull --ff-only origin main && npm ci && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Não é necessário aplicar migração ou reiniciar a API para este ajuste visual. Para aplicativo nativo instalado, distribuir uma versão atualizada pelo fluxo de distribuição já adotado.

## Backlog de conferência em campo

- [ ] Conferir o sino junto de recarregar no aparelho do catador, na vertical e na horizontal.
- [ ] Conferir a central com avisos reais de recebimento, triagem e diferença de quantidade.
- [ ] Testar filtros, leitura e fechamento da janela no celular.
- [ ] Conferir fonte ampliada e área segura em aparelhos físicos. As verificações automatizadas de navegador não substituem essa inspeção.
