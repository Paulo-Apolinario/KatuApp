# Alinhamento dos botões dos indicadores — 29/10/2026

Os quatro cards da situação operacional apresentam seus botões alinhados à esquerda e na base, na mesma altura por linha da grade. A margem superior automática absorve a diferença de altura das descrições. Usadas as classes Bootstrap `align-self-start mt-auto` nos dois tipos de ação, preservando destinos, callbacks e o tamanho natural dos botões.

## Validação

- ESLint do componente: aprovado.
- Build Vite de produção: aprovado; aviso existente de chunk acima de 500 kB permanece.
- Chromium local, dados simulados, larguras 1366, 768 e 390 px: aprovado. Conferidos os quatro botões, alinhamento à esquerda, altura igual entre cards na mesma linha, largura dentro do card e funcionamento de “Ver pendências”. Sem erros de JavaScript.
- Nenhuma alteração de API, banco ou App. Nenhum acesso à VPS.

## Publicação pelo responsável

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

Atualizar o navegador com Ctrl+Shift+R. Não exige reinício da API.

## Acompanhamento

- [ ] Conferir os quatro cards com os dados reais após a publicação na VPS.
