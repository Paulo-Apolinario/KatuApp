# Botão Analisar e diagnóstico da publicação do App — 29/10/2026

## Ajuste entregue

O atalho **Analisar**, em Pendências de atendimento no painel operacional, usa o mesmo padrão de botão pequeno verde contornado do painel. Continua sendo um link de navegação, com o destino original, foco de teclado e descrição acessível da solicitação. Mantém o alinhamento na linha e não encolhe em telas estreitas.

Validação: ESLint do componente e build do painel aprovados. Conferência no Chromium local em desktop e 390px verificou borda/espaçamento, destino preservado, foco de teclado, botão dentro da largura e ausência de erros JavaScript. Nenhuma alteração de API, schema ou telas da cooperativa no App.

Para atualizar o painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

## App residencial ainda exibindo versão antiga

A entrega residencial está publicada na main do KatuApp desde o commit `9e0ace047c9245a0639c39be359ab78d9c2964ac`. Nesta entrega não foi executado acesso à VPS nem foi verificado o diretório efetivamente servido pelo Nginx.

A orientação anterior gerava o export em `/var/www/katua/app/dist`, mas não conferia se esse era o destino publicado pelo domínio. **Gerar o export e publicar o domínio são etapas distintas quando o Nginx aponta para outra pasta.** Essa conferência faltou na instrução anterior.

Ainda não há evidência para atribuir a tela antiga definitivamente a pasta, cache ou revisão do código. Não copiar arquivos para um destino presumido e não alterar o Nginx sem ler a configuração existente.

O App residencial deve ser aberto em `https://app.katua.com.br/residential-home`, com uma conta PF. Esse endereço exclusivo faz parte do novo export. Aplicativo nativo instalado exige uma versão nativa correspondente; compilar web não atualiza um binário nativo.

Conferir revisão e presença da nova tela no export:

```bash
cd /var/www/katua/app && git log -1 --oneline && ls -l dist/residential-home.html
```

Conferir somente os nomes dos domínios e caminhos de publicação existentes:

```bash
sudo nginx -T 2>/dev/null | grep -E 'server_name|root |alias '
```

Interpretação:

- Código sem a entrega residencial: conferir checkout/pull e eventual erro no comando anterior.
- `dist/residential-home.html` ausente: o novo export não foi concluído nessa pasta.
- Export existe, mas o domínio aponta para outra pasta: falta publicar o export no destino verificado.
- Domínio serve a mesma pasta com export recente: conferir a resposta pública, cache do navegador/proxy e o endereço aberto.

**Pendência:** receber as saídas do servidor para indicar a correção exata da publicação. O botão está concluído; o motivo da versão antiga do App ainda está em diagnóstico.
