# Botão de solicitações e localização da cooperativa — 27/10/2026

## Entregue
- [x] Corrigir o alongamento vertical de “Atualizar solicitações”: alinhamento no topo, ícone e indicação de carregamento. Preservar atualização e bloqueio de chamadas simultâneas.
- [x] Substituir a visualização incorporada do cadastro de cooperativa por mapa interativo na web, com marcador da sede arrastável e seleção por clique/toque.
- [x] Permitir latitude/longitude editáveis na mesma tela em web e nativo, aceitando ponto ou vírgula decimal e validando os dois valores e seus limites.
- [x] Aplicar coordenadas ao mapa antes da confirmação; edição pendente/inválida bloqueia confirmar. GPS continua como alternativa, com erro visível.
- [x] Manter os dados do rascunho e devolver a posição confirmada ao formulário de cadastro.
- [x] A visualização inicial de Fortaleza não conta como localização escolhida. Exigir seleção explícita no seletor.
- [x] Layout rolável com áreas seguras para uso em celular; mapa nativo com arraste e recentralização quando o ponto muda.

## Validação
- TypeScript do App e ESLint dos arquivos alterados aprovados.
- Exportação web do Expo e build de produção do painel aprovados. Permanece o aviso conhecido de tamanho dos chunks do painel.
- 7 verificações de navegador aprovadas: ausência de ponto inicial, coordenadas com vírgula, edição inválida, arraste, clique, celular/retorno do ponto ao cadastro e botão compacto com recarga efetiva.
- Navegador usando as interfaces reais e respostas de API, GPS e tiles controladas. Sem criação de cooperativa real. Capturas conferidas em desktop e 390 px.
- Código nativo verificado por TypeScript; gestos em Android/iOS físico ainda precisam de conferência após instalar nova versão nativa.

## Publicação e atualização
Alterações nos repositórios KatuApp e Katua_Web, branch main. Atualizar painel e exportação web do App. Não há alteração da API, banco ou migração nova. A versão Android/iOS instalada requer novo build para receber o ajuste nativo.

## Backlog
- [ ] Validar arraste e teclado nos aparelhos Android/iOS usados pela cooperativa.
