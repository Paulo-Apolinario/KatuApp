# Barra inferior do aplicativo — 23/10/2026

## Problema confirmado

A imagem enviada mostra os textos dos itens inferiores cortados na tela do catador. Os layouts usavam alturas fixas, margens e preenchimentos que comprimiam os rótulos. Na exportação anterior, o teste em Chromium reproduziu um rótulo de 11 px com caixa de apenas 7 px de altura e conteúdo de 13 px: parte do texto ficava ocultada. A área segura inferior também não era incorporada ao cálculo da altura definida no aplicativo.

## Alterações

- [x] Centralizar as opções das barras de catador, pessoa física e gerador em `useBottomTabOptions`.
- [x] Calcular a altura reservando espaço para a área segura inferior e para o crescimento de texto informado pelo aparelho.
- [x] Remover o preenchimento vertical extra dos itens e ajustar margens/altura de linha dos rótulos.
- [x] Manter os nomes abaixo dos ícones também na horizontal e os alvos de toque utilizáveis.
- [x] Usar “Recibos” como nome curto do item do catador. A tela acessada continua com o título “Comprovantes”.
- [x] Adicionar o documento HTML do Expo web com `viewport-fit=cover` e altura dinâmica `100dvh`, preservando o comportamento anterior como fallback em navegadores sem suporte.
- [x] Preservar o espaço da barra no fluxo normal de navegação; não posicioná-la sobre o conteúdo rolável.

A altura dinâmica permite acompanhar as mudanças das barras do navegador móvel. Referência: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length

## Validação

- [x] `npm run check` sem erros.
- [x] `npm run lint` sem erros ou avisos.
- [x] Exportação Expo web com sucesso.
- [x] 18 cenários de geometria no aplicativo exportado: catador, pessoa física e gerador; telas de 320×568, 390×844 e 844×390; área segura simulada de 0 e 34 px. Os cinco rótulos cabem nos itens, com altura suficiente para o texto, fora da área segura e com alvos de toque de pelo menos 44 px.
- [x] 2 verificações adicionais no catador: a última ação da tela inicial permanece acessível ao rolar até o final, e o item inferior abre os comprovantes.
- [x] Comparação visual das capturas antes e depois; corte reproduzido na versão anterior e ausente na versão corrigida.

Teste: `tests/layout/bottom-tabs.mjs`, executado com Playwright/Chromium, exportação real do Expo e sessão/API controladas. As áreas seguras são simuladas; não representam uma execução em celular físico.

## Publicação junto do GPS

Alteração somente no KatuApp, branch `main`, posterior à correção de GPS `66d406316c472c736956a963da4f7f188c8b24fd`. Um único pull e uma nova exportação web incluem as duas atualizações:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && npm ci && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

Não há migração de banco nem alteração da API ou do painel Katua_Web. A atualização da VPS é realizada pelo responsável pelo ambiente. Para aplicativo nativo instalado é necessário distribuir a atualização pelo fluxo adotado para esse aplicativo.

## Backlog de conferência após atualização

- [ ] Conferir no celular da imagem se os cinco nomes aparecem completos, na vertical e na horizontal.
- [ ] Repetir com as barras do navegador abertas e recolhidas e com navegação por gestos do aparelho.
- [ ] Conferir fonte ampliada e abertura/fechamento do teclado em um aparelho real.
- [ ] Validar na mesma publicação a posição, precisão e identificação opcional da cidade descritas em `gps-localizacao-aparelho-2026-10-23.md`.
