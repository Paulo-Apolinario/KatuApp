# GPS e identificação de cidade — 23/10/2026

## Problema e diagnóstico

A tela inicial mostrava “GPS ativo — cidade não identificada”. O adaptador web obtinha coordenadas via `navigator.geolocation`, mas `reverseGeocodeAsync` retornava sempre `[]`. Portanto, ausência de cidade não demonstrava falha na aquisição da posição. O cabeçalho também só permitia tentar novamente quando havia erro e não mostrava a precisão da leitura.

## Entregas

- [x] Substituir o cabeçalho de localização das telas iniciais da cooperativa e da pessoa física por um cartão com posição, precisão aproximada em metros, horário da leitura e coordenadas.
- [x] Reutilizar `useForegroundLocation`: leitura inicial com alta precisão, acompanhamento enquanto a tela está ativa, cancelamento ao sair e retomada ao voltar.
- [x] Permitir atualizar manualmente mesmo depois de uma leitura bem-sucedida.
- [x] Separar posição do aparelho da identificação opcional de cidade/localidade.
- [x] Incluir consulta de cidade diretamente do aparelho, apenas após confirmação explicando o envio ao BigDataCloud, o recebimento do IP e a finalidade informada pelo fornecedor.
- [x] Recusar respostas de localização por IP, de coordenadas divergentes ou sem localidade; nunca substituir a posição por endereço cadastrado ou por um ponto padrão.
- [x] Renovar a leitura antes da consulta; aceitar somente coordenadas válidas com leitura recente. Nenhum nome, e-mail, token ou dado de coleta é enviado ao serviço externo.
- [x] Manter a posição disponível quando a consulta de cidade falha; tempo limite de 8 segundos na consulta externa e cancelamento ao mudar de célula/tela.
- [x] Apresentar a localidade somente na sessão/tela e descartar ao mudar a célula de posição (arredondamento a três casas). Não realizar consultas externas periódicas pelo acompanhamento do aparelho.
- [x] Exibir orientação de precisão reduzida acima de 100 metros, sem impedir o uso ou prometer precisão maior.
- [x] Melhorar mensagens de posição indisponível, leitura antiga e pausa. O componente compartilhado nos mapas de cooperativa, catador e motorista também recebe o estado de atividade.
- [x] Remover a função web sem implementação e adequar o cabeçalho da tela legada de login da cooperativa ao mesmo componente.

## Integração e privacidade

A identificação opcional usa o endpoint client-side `https://api.bigdatacloud.net/data/reverse-geocode-client`, diretamente do navegador/aparelho, com coordenadas atuais e `localityLanguage=pt`. Não há chave ou configuração de API necessária. O usuário confirma cada consulta. Não existe consulta de cidade antes dessa confirmação nem fallback por IP. A posição continua utilizável sem essa consulta.

O fornecedor descreve a utilização de pares de coordenadas e IP para aprimorar sua base de geolocalização. A tela apresenta essa informação e link de privacidade antes do envio. A identificação de localidade não certifica endereço ou precisão; a precisão em metros vem da leitura do aparelho.

Referências oficiais verificadas em 23/10/2026:

- https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api
- https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free
- https://www.bigdatacloud.com/privacy-and-cookie-policy

## Validação

- [x] TypeScript do aplicativo (`npm run check`).
- [x] Lint do aplicativo (`npm run lint`), sem erros ou avisos.
- [x] Exportação Expo web com sucesso.
- [x] 10 testes automatizados de aquisição/validação de posição e consulta de cidade: sucesso, permissão negada, HTTPS, leitura inválida/antiga, acompanhamento/cancelamento, coordenadas enviadas, ausência de cookies, resposta por IP e indisponibilidade do fornecedor.
- [x] 10 verificações de interface em Chromium com componentes reais React Native Web e transporte/leitura controlados: ausência de consulta automática, precisão/coordenadas, cancelar consentimento, identificar cidade, atualizar após sucesso, mudança de posição, falha de cidade preservando posição, negação, pausa e ausência de exceções JavaScript.
- [x] 2 verificações do aplicativo Expo web exportado em Chromium: posição permitida mostra precisão e negação tem mensagem explícita. Sessão/API e geolocalização controladas; nenhuma coordenada real foi enviada ao fornecedor.

Comandos dos testes de contrato:

```bash
node --import ./server/node_modules/tsx/dist/loader.mjs --test tests/location/browser.test.ts tests/location/current-city.test.ts
```

Os testes de interface usam Playwright e Chromium, com `KATUA_VALIDATION_TOOLS` e `KATUA_CHROMIUM_PATH`. O teste `tests/location/web-browser.mjs` também recebe `KATUA_APP_WEB_EXPORT` apontando para a exportação Expo.

## Atualização

Alterações somente no aplicativo KatuApp, branch `main`. Não há mudança de schema, migração de banco, API, credenciais ou painel Katua_Web. Para o app web é necessário atualizar o repositório e gerar novamente `dist` por `npx expo export --platform web --output-dir dist`. Para aplicativo nativo instalado, é necessário distribuir uma compilação/atualização compatível com o fluxo de distribuição adotado.

## Backlog de verificação em campo

- [ ] Depois da publicação pelo responsável pela VPS, conferir no celular do teste a leitura, o horário e a precisão; comparar a posição com o local real.
- [ ] Repetir em local fechado e área aberta, com permissão concedida e negada, e testar retorno de segundo plano.
- [ ] Conferir o botão “Identificar cidade” na rede móvel real, incluindo recusa da consulta e indisponibilidade de internet. Acesso real ao serviço externo não foi exercitado pelos testes automatizados.

O navegador/sistema operacional controla as fontes e a precisão da posição. A alteração corrige o diagnóstico e a experiência de uso; testes simulados não comprovam recepção de GPS dentro de um estabelecimento específico.
