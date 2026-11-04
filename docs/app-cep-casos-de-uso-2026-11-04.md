# App Web — CEP, mapa e dez casos de uso

Data: 04/11/2026. Escopo: App Web. Validação em Chromium, com API local e banco descartável; nenhum acesso aos dados de produção. CEP, geocodificação e GPS simulados. Não foram executados builds Android/iOS nem testes do painel nesta entrega.

## Problemas corrigidos

1. **Endereço alterado com ponto anterior disponível.** Editar CEP, rua, número, bairro, cidade ou UF agora remove o ponto anterior e invalida sua confirmação. A consulta de endereço espera a resolução do CEP atual. CEP inexistente não permite reaproveitar silenciosamente as coordenadas antigas; marcação manual e GPS continuam disponíveis.
2. **Respostas atrasadas.** Consulta de CEP e geocodificação usam a revisão do endereço e os dados mais recentes do formulário. Resposta ou falha de uma busca antiga não pode substituir um endereço já alterado. Um bloqueio imediato evita iniciar consultas duplicadas no mesmo instante.
3. **Mapa com marcador selecionado.** A câmera acompanha mudanças de coordenadas do ponto selecionado, mesmo quando seu identificador não mudou. A correção vale também para os PEVs, que usam o mesmo cadastro.
4. **Rascunho sem referência ao recarregar.** O formulário editável só abre quando a URL contém a identificação do rascunho. A referência permanece no recarregamento e a mudança de URL não descarta os primeiros campos digitados. A resolução do CEP também é preservada no rascunho.
5. **Mensagem de salvamento desatualizada.** A confirmação local considera o conteúdo que terminou de ser gravado. Nova edição deixa de exibir a confirmação do conteúdo anterior enquanto aguarda persistência. Erro de armazenamento impede concluir o cadastro como se o rascunho estivesse salvo.
6. **Abrir cadastro após sincronizar.** A identificação interna `generators` passa a apontar para a tela `geradores`, mantendo o caminho próprio de PEVs.

A localização retornada pela base de mapas continua exigindo conferência pelo usuário. Trocar endereço exige nova busca ou marcação e nova confirmação. Não houve alteração de esquema, migração ou comportamento de produção da API.

## Casos de uso executados

Os dez casos completos, incluindo pré-condições, ações e verificações automatizadas, estão em `server/tests/app-scenarios/README.md`. O executável é `server/tests/app-scenarios/browser.mjs`. Resultados desta entrega em `docs/validacao-app-cenarios-2026-11-04.json`.

| Caso | Perfil / área | Situação | Resultado esperado |
|---|---|---|---|
| UC01 | Cooperativa | Trocar CEP após selecionar e confirmar o marcador; repetir buscas pelos botões. | Endereço e ponto atualizados; nova confirmação obrigatória; marcador visível. |
| UC02 | Cooperativa | Trocar CEP durante buscas lentas de CEP e de coordenadas. | Respostas antigas não sobrescrevem a edição recente. |
| UC03 | Cooperativa | CEP inexistente, correção por GPS, recarregamento e envio do cadastro. | Rascunho e confirmação preservados; cadastro sincronizado abre na tela correta. |
| UC04 | PEVs | Corrigir CEP, confirmar, criar e abrir um PEV. | Um único cadastro com as coordenadas corrigidas. |
| UC05 | Geradores / cooperativa | Buscar e paginar 22 cadastros; trocar filtro e abrir atendimentos e mapa. | Página e cadastro corretos, sem repetição dos resultados. |
| UC06 | Relatórios e análises | Datas impossíveis/invertidas; erro 503; recuperação; estoque atual. | Validação clara e nova tentativa, sem interpretar erro como resultado vazio. |
| UC07 | Motorista / cooperativa | GPS negado e autorizado; acompanhamento; novo ponto durante rota; fim do compartilhamento. | Posição visível apenas durante compartilhamento ativo e ponto novo registrado na execução. |
| UC08 | Catador | Início offline, observações, recarregamento e reconexão. | Registro local recuperado e início confirmado remotamente somente após envio. |
| UC09 | Catador / cooperativa | Coleta de óleo concluída, recebida e conferida, com 50 litros. | Histórico e trabalho mantêm 50 L sem conversão para kg. |
| UC10 | Gerador | Aceite do termo; data/hora inválidas; correção e envio de solicitação com material e 2,5 unidades estimadas. | Máscaras brasileiras, validação, confirmação pela API e retorno ao início do gerador. |

## Atualização na VPS

```bash
cd /var/www/katua/app && git pull --ff-only origin main && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
```

Usar o comando `export:web` para incluir a atualização da PWA. A preparação offline inicial depende de acesso com internet. Os testes esperam a ativação do service worker antes de desconectar a rede. A publicação do código não executa esse comando na VPS automaticamente.
