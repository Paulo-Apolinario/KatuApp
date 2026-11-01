# KATUÁ — funcionamento offline no navegador

Implementação de 31/10/2026. Escopo: App Web em HTTPS, com abertura offline após preparação online. O painel administrativo não recebe service worker nesta entrega.

## Comportamento entregue

A perda da conexão não encerra a sessão local. O App preparado pode ser recarregado ou reaberto offline, inclusive em uma rota interna. A faixa superior diferencia preparação, abertura offline pronta, ausência de conexão e pendências de envio. O usuário pode abrir **Dados offline e rascunhos**, preparar dados e retomar formulários salvos.

| Fluxo | Disponibilidade sem internet |
| --- | --- |
| Abrir/recarregar App preparado | Shell, ícones, fontes e rotas da aplicação |
| Diretórios da cooperativa | Cadastros e atendimentos já baixados; pesquisa local identifica que consulta somente dados do aparelho |
| Novo gerador / PEV na cooperativa | Formulário, coordenadas confirmadas e rascunho locais; cadastro fica pendente até confirmação da API |
| Coletas e rotas em campo | Reutiliza os repositórios e a fila existentes; início, conclusão e ocorrências continuam sujeitos às regras operacionais do servidor |
| Observações e materiais da coleta do catador | Rascunho por coleta, restaurado ao voltar ao atendimento |
| Ordem de coleta extra | Rascunho existente, incluindo fotos já codificadas, passa a ser persistido em IndexedDB no navegador |
| Relatórios e demais consultas permitidas | Respostas previamente abertas e baixadas; não representa consulta atualizada ao servidor |
| Outras alterações de cadastro e solicitações | Não foram convertidas indiscriminadamente em operações offline |
| Mapa de fundo, CEP, geocodificação e localização ao vivo | Dependem dos serviços/conexão; GPS disponível no aparelho pode marcar coordenadas sem baixar o mapa |

A preparação da cooperativa baixa a primeira página dos quatro diretórios e seus detalhes. Outras páginas e relatórios devem ser abertos online. Para os demais perfis, o centro informa quais trabalhos/resumos foram preparados. Nunca equivale a baixar todo o banco.

## Shell e atualização

`npm run export:web` exporta o Expo e executa `scripts/build-pwa.mjs`. O pós-processamento gera `sw.js`, injeta o identificador da versão em todos os HTMLs e produz `offline-build.json`. A versão depende dos arquivos e do template do worker. Fontes com `@` usam a mesma URL pedida pelo Expo, evitando ícones ausentes offline.

O worker pré-carrega os arquivos estáticos em grupos e só grava o marcador de prontidão após concluir todos. Falha de instalação remove somente o cache incompleto daquela versão. Navegação usa a rede com limite de quatro segundos e, em falha, o shell local. São retidas até três versões de shell. A instalação de nova versão não força recarregamento. A ativação é solicitada pelo usuário, sem operações de envio pendentes e sem gravação local em andamento.

CacheStorage contém apenas arquivos estáticos. O worker ignora requisições autenticadas, outros domínios e métodos diferentes de GET. Não armazena respostas da API nem posições de motoristas.

## Dados e integridade

- IndexedDB `katua-offline-v1`, object store `records`: tabelas locais, respostas de consulta, rascunhos e confirmações de protocolos.
- Migração de `@katu:offline:*`: lê o formato anterior; remove a chave antiga somente após confirmar a transação IndexedDB. Falha não apaga o original.
- Escritas de tabela usam transações de leitura/modificação/gravação. Dados de uma conta são filtrados pelo proprietário. O login corrente do navegador prevalece sobre o snapshot antigo de sessão, inclusive após troca de conta em outra aba.
- Perda de conexão ou erro 5xx não desloga o usuário. Rejeição de autenticação confirmada mantém a fila no aparelho, mas exige novo acesso autorizado para envio.
- Rascunhos indicam gravação em andamento, gravação concluída ou erro. Não anuncia sucesso quando falta espaço. O navegador avisa antes de sair enquanto há gravações locais iniciadas.
- O centro solicita armazenamento persistente quando o navegador disponibiliza a função. A concessão depende do navegador. Limpar os dados do site ou remoção do armazenamento pelo sistema pode apagar operações ainda não enviadas.

## Protocolo de cadastro offline

Migração aditiva: `20261031020000_mobile_offline_operations`. Tabela `MobileOfflineOperation` registra protocolo, usuário, cooperativa, tipo, hash do conteúdo, entidade criada e data.

`POST /mobile-offline/operations` aceita `operationId` UUID, `kind` (`GENERATOR_CREATE` ou `PEV_CREATE`) e `data`. Reutiliza validações de negócio. Exige coordenadas confirmadas, sem geocodificação externa dentro da transação.

A API bloqueia a linha da cooperativa e cria entidade, evento de PEV quando aplicável e protocolo na mesma transação. Repetir protocolo e conteúdo devolve a entidade existente. Reutilização com conta ou conteúdo diferente retorna conflito. Nenhum registro parcial permanece após falha.

`GET /mobile-offline/operations/:id` confere confirmação sob o mesmo bloqueio. Antes de oferecer correção de uma pendência rejeitada, o cliente confirma online que o protocolo não foi gravado; cria novo rascunho durável antes de retirar a operação anterior. Uma resposta perdida após commit é recuperada reenviando os mesmos dados.

A fila é persistida antes da tentativa de envio. Falhas de rede mantêm o protocolo para nova tentativa com espera progressiva. Rejeições de validação/permissão/conflito exigem revisão; o envio automático não as repete continuamente. Web Locks serializa sincronizações entre abas quando suportado; a API conserva a proteção contra duplicação. A conta é conferida antes de enviar, e respostas de uma sessão trocada não alimentam a conta atual.

## Atualização da VPS

Na cópia do App:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && npm ci && cd server && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Depois, gerar o Web incluindo o worker:

```bash
cd /var/www/katua/app && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
```

Servir `dist` no domínio `https://app.katua.com.br`. O endereço `/sw.js` deve devolver JavaScript, `/manifest.webmanifest` o manifesto e as rotas internas o App. Não substituir por um export que omita `build-pwa.mjs`. A API não usa `/api` na URL base. O painel não precisa de build para esta entrega.

## Aceitação no aparelho

1. Abrir o App com internet, entrar na conta e aguardar **App pronto para reabrir offline**.
2. Em **Dados offline e rascunhos**, preparar os dados e abrir o trabalho que será executado.
3. Ativar modo avião, recarregar a página e fechar/reabrir a aba. Conferir sessão e dados baixados.
4. Preencher observações/cadastro; aguardar a confirmação de salvamento no aparelho; recarregar e conferir o rascunho.
5. Salvar uma operação offline e conferir **aguardando envio**. Não confundir com confirmação do servidor.
6. Reativar conexão com App aberto e acompanhar a sincronização. Conferir um único registro no painel.
7. Repetir em Chrome/Android e Safari/iPhone; instalar na tela inicial é opcional. Verificar também fotos reais e permissões de localização nesses aparelhos.

A automação usa Chromium real em ambiente descartável e API/PostgreSQL compatível local, sem registros de produção. Exports Android/iOS verificam compilação; não substituem os testes em aparelhos físicos. Execução contínua em segundo plano ou com navegador encerrado não é prometida. A sincronização ocorre com o App aberto ou reaberto.
