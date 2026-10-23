# Localização do aplicativo e painel inicial — 21/10/2026

## Análise e entrega autorizada

Correção da obtenção da posição do aparelho e melhoria do painel inicial e seu mapa. A imagem anexada foi aberta e conferida. As alterações estão nos repositórios KatuApp e Katua_Web; a implantação da VPS continua com o responsável pelo ambiente.

## Problemas encontrados

- As telas do app solicitavam localização separadamente e, nos mapas, faziam apenas leitura pontual. O retorno ao aplicativo e a saída das telas não tinham um ciclo comum para acompanhar/cancelar atualizações.
- O app web chamava a geocodificação reversa do Expo e interpretava a ausência de endereço/cidade como falha do GPS. O Expo pode obter as coordenadas no navegador sem retornar o nome da cidade.
- A seleção pública de perfil tinha efeito sem lista de dependências, repetindo a solicitação após renderizações. A negação de permissão também abria configurações automaticamente em alguns fluxos.
- No motorista, uma falha da posição estava dentro do carregamento dos dados: podia apresentar erro de GPS como falha de rotas/coletas.
- O mapa nativo usava somente a região inicial. Mudanças posteriores da posição não garantiam enquadramento da primeira leitura. A seleção de um ponto precisava preservar o nível de zoom.
- O painel reunia respostas independentes e substituía falhas parciais por listas vazias, produzindo contagens aparentemente zeradas. A leitura de entradas usava limite fixo de 200 registros.
- O mapa do painel dependia de chave Google, apresentava apenas geradores e não diferenciava adequadamente cadastros sem coordenadas. A mensagem de ausência de pendências não incorporava a central real de alertas.

## Aplicativo: alterações

- Serviço central de localização com implementações nativa e web, utilizado nas telas de perfil público, PF, cooperativa, motorista e seletores de endereço.
- No navegador, utiliza a geolocalização do próprio aparelho, com exigência de contexto seguro, leitura recente, alta precisão solicitada e tempo de espera limitado. Permissão negada não gera coordenadas padrão.
- No nativo, a leitura inicial verifica se o GPS está habilitado e possui limite de espera. Não utiliza uma posição histórica como se fosse atual.
- Os mapas de cooperativa, catador e motorista acompanham a posição enquanto a tela está em foco e o aplicativo em primeiro plano. A assinatura é cancelada ao sair ou colocar o app em segundo plano; a leitura é retomada ao retornar. Não foi implementado rastreamento em segundo plano.
- Exibição de precisão aproximada, hora da leitura, coordenadas, falha de permissão/obtenção, ação para atualizar e acesso manual às permissões do aparelho.
- GPS e dados operacionais têm tratamento independente: não se perde a lista de operações por falha de posição.
- Posição do aparelho e região de referência são distintas; um centro padrão do mapa não recebe rótulo de posição atual. Distâncias/origens dependentes do GPS não são exibidas como atuais quando falta a posição.
- A câmera nativa pode enquadrar a primeira posição e centralizar um ponto selecionado preservando o zoom na seleção. A visualização web existente continua usando o mapa incorporado, com rótulos coerentes para a posição/referência.
- A falta de cidade no web passa a mostrar “GPS ativo — cidade não identificada”. Não se presume Fortaleza ou Jijoca como cidade atual, nem se envia a coordenada a um novo serviço de geocodificação.
- Nos seletores web, falhas são exibidas na própria tela, sem depender de `Alert.alert` nativo.
- Foi restaurada a função de tradução de situações de coleta que já era importada por telas do motorista, evitando função ausente durante a renderização dessas telas.

A precisão e a frequência efetivas dependem do aparelho, permissões, sinal, sistema operacional e navegador. O app solicita atualizações em primeiro plano com intervalo/distância moderados; não promete posição de precisão fixa ou intervalo garantido. A opção de localização aproximada do sistema continua sendo respeitada.

Referências técnicas: pacote `expo-location` 19.0.8 do projeto e documentação Expo Location: https://docs.expo.dev/versions/v54.0.0/sdk/location/. Não houve atualização da versão do Expo.

## Painel inicial: alterações

| Área | Resultado |
| --- | --- |
| Cabeçalho | Identificação da cooperativa, data no fuso do Ceará, horário da atualização e botão de recarga. |
| Situação atual | Solicitações pendentes, coletas em campo, aguardando recebimento e entradas com saldo a destinar. As quantidades permanecem separadas por unidade. |
| Central de atenção | Integração às contagens de avisos abertos/prioritários da central, excluindo adiados. Ausência de avisos não é apresentada como garantia de ausência de problemas. |
| Agenda de hoje | Coletas com data programada no agendamento ou na rota, sem substituir essa programação pela data de criação. |
| Resultados por período | Filtro de datas, execução, quantidades, ausência de medição e comparação com período anterior equivalente. Usa as regras já validadas dos relatórios. |
| Evolução e fluxo | Gráfico com unidade escolhida, estoque atual e saldo a destinar em seções distintas, sem somá-los como nova produção. |
| Registros recentes | Até oito coletas por criação, com situação, origem, rota/veículo e acesso à conferência. A ordem é identificada como criação, não execução. |
| Confiabilidade | Falha de carregamento exibe erro e recuperação, sem preencher cartões com zero ou mostrar ausência de pendências. |

O período atua sobre resultados e gráficos. Cartões operacionais e estoque são situação atual, com indicação explícita. Quantidade ausente não é pesagem zero; litros/m³/unidades não são convertidos indevidamente em kg.

Nova rota protegida: `GET /dashboard/overview?start=AAAA-MM-DD&end=AAAA-MM-DD`. A cooperativa é determinada pela autenticação ativa. Não aceita escolher outro escopo por ID. As contagens atuais são feitas no banco e o saldo é agrupado por unidade, evitando o limite antigo de 200 entradas. Não se retorna CPF, credenciais ou contatos pessoais da equipe.

## Mapa do painel

- Leaflet/OpenStreetMap, sem exigir chave Google para o painel.
- Geradores e PEVs com marcadores distintos e sede separada, somente com coordenadas válidas.
- Busca por nome/município e filtros de tipo e município; lista paginada que inclui os cadastros sem coordenadas.
- Enquadramento dos pontos, localização de um ponto da lista, identificação/cadastro pelo marcador e ampliação do mapa.
- Minha posição é solicitada por ação do usuário; exibe a posição daquela leitura e não simula rastreamento da equipe.
- Falha no mapa-base ou permissão de GPS não impede a lista e o acesso aos cadastros.
- Coordenadas zero são válidas; valores ausentes, não finitos ou fora dos limites não viram marcadores.
- Pontos coincidentes mantêm a coordenada verdadeira e podem ser selecionados pela lista; não são deslocados artificialmente.

Os marcadores refletem cadastros, não a posição em tempo real de motoristas/catadores. Não há cálculo de trajeto rodoviário no painel. O mapa-base depende de acesso à rede OpenStreetMap.

## Limites conhecidos

- O resumo por período herda até 366 dias e o limite de 20 mil registros por conjunto dos relatórios. Se ultrapassado, há erro explícito, sem truncamento silencioso dos totais.
- O mapa inicial carrega até 1.000 cadastros de cada tipo e informa se esse limite for atingido. Cadastros completos continuam nos módulos de gestão.
- A agenda mostra até 50 operações e informa quando há mais. Registros recentes são os oito últimos criados.
- A central de atenção usa os alertas registrados. A reavaliação das condições ocorre ao abrir a central e no processamento periódico já existente; não é uma auditoria integral a cada abertura do painel.
- O web do Expo não resolve o nome da cidade nesta entrega; informa a coordenada/GPS sem tratar isso como falha. Um eventual serviço de cidade por coordenadas será uma decisão específica, com tratamento de privacidade, rede e cache.
- O mapa web do aplicativo permanece incorporado. A melhoria com vários tipos de marcadores e filtros desta entrega é do painel React/Vite.

## Validação

- API: TypeScript e build de produção aprovados.
- Painel: lint das alterações, build de produção e seis cenários de integração com API real/Prisma/PGlite e Chromium: cálculos/unidades/estoque, isolamento/autorização/datas, gráfico e filtros do mapa, GPS permitido/negado, layout móvel e recuperação sem zeros falsos.
- App: cinco testes do serviço de geolocalização (leitura, negação, HTTPS, coordenadas/idade e cancelamento de watch), verificação TypeScript direcionada às telas/serviços de localização e export web estático concluído.
- App exportado: dois cenários Chromium de GPS permitido e negado, sem chamadas externas. Coordenadas simuladas pelo navegador; não equivalem a validação de sensor físico Android/iOS.
- Capturas do painel em desktop/celular e do app exportado foram inspecionadas. Mapa-base externo foi bloqueado nos testes para verificar a apresentação alternativa com lista e avisos.
- O `tsc` geral da raiz do app ainda tem pendências anteriores em agendamentos e testes do servidor; a verificação direcionada desta entrega não declara esse conjunto geral aprovado. Não foram alterados esses módulos para mascarar as pendências.

Testes: `tests/location/browser.test.ts`, `tests/location/web-browser.mjs`, `tests/location/tsconfig.json`, `server/tests/dashboard/local-server.ts` e `frontend/tests/dashboard-browser.mjs`. O runner do painel usa as mesmas ferramentas externas/portas locais dos testes anteriores. Não acrescenta dependências de produção.

Comandos de validação do app:

```bash
npx tsc --noEmit -p tests/location/tsconfig.json
node --import ./server/node_modules/tsx/dist/loader.mjs --test tests/location/browser.test.ts
npx expo export --platform web --output-dir dist
```

O runner web do app recebe `KATUA_APP_WEB_EXPORT`, `KATUA_VALIDATION_TOOLS`, `KATUA_PLAYWRIGHT_MODULE`, `KATUA_CHROMIUM_PATH` e opcionalmente `KATUA_VALIDATION_OUTPUT_ROOT`. Serve apenas localmente na porta 8089. Fixtures do painel recusam banco fora de 127.0.0.1:54329.

## Atualização do ambiente

Esta etapa não cria nova migração, mas depende das migrações anteriores de relatórios/configurações. Atualizar a API pela main, instalar dependências, compilar, reiniciar `katua-api.service` e depois atualizar/compilar o painel. Preservar `.env`, uploads, chave de criptografia e ajustes locais. Não usar PM2 nem resetar alterações da VPS.

O app também precisa receber a atualização:

- Web: gerar novo export Expo na raiz do KatuApp e publicar seu resultado no diretório já configurado para `app.katua.com.br`, preservando HTTPS e as regras existentes do servidor. Compilar somente o painel não atualiza o app.
- Android/iOS instalados: gerar/distribuir uma nova versão conforme o fluxo atual do projeto. Atualizar a VPS não troca o JavaScript embutido em um aplicativo já instalado.
- Conferir permissão de localização e GPS no dispositivo; testar sob HTTPS no navegador. Confirmar negação e nova tentativa, movimentação com a tela em foco, saída/retorno à tela e ausência de acompanhamento em segundo plano.

Não foi realizado acesso ou deploy da VPS nesta entrega. Não foram alteradas a MTR ou as credenciais de integração.

## Backlog

### Concluído

- [x] Centralizar posição do aparelho por plataforma e limitar a espera.
- [x] Separar GPS de identificação da cidade e dados operacionais.
- [x] Acompanhar posição em primeiro plano e cancelar ao sair.
- [x] Exibir precisão/hora/falhas e permitir nova tentativa.
- [x] Corrigir repetição de solicitação na seleção pública de perfil.
- [x] Reestruturar painel com contagens confiáveis, período e agenda.
- [x] Integrar central de atenção e preservar separação de unidades/etapas.
- [x] Mapa do painel com geradores/PEVs/sede, filtros e lista de cadastros incompletos.
- [x] Testes reproduzíveis e documentação.

### Próximas validações/evoluções

- [ ] Confirmar GPS em aparelhos físicos Android/iPhone após instalação da nova versão.
- [ ] Validar permissões/configuração de navegador e rede no domínio real do app.
- [ ] Tratar as pendências anteriores do TypeScript geral de agendamentos/testes do servidor.
- [ ] Considerar geocodificação reversa web para nome de cidade, com decisão de provedor, cache e privacidade.
- [ ] Agrupamento espacial e carregamento por área para mapas com milhares de pontos.
- [ ] Evoluir o mapa incorporado do app web para mapa com múltiplos marcadores.
- [ ] Trajetos rodoviários e estimativas verificáveis somente com integração específica; não confundir linhas entre pontos com navegação real.

Resultados dos testes automatizados: [validacao-localizacao-painel-2026-10-21.json](validacao-localizacao-painel-2026-10-21.json).
