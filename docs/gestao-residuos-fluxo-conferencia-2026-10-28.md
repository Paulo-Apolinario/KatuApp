# Gestão de resíduos — fluxo, conferência e rastreabilidade

Data: 28/10/2026. Escopo autorizado: API e painel das cooperativas.

## Resultado e fluxo operacional

Receber a coleta → conferir quantidades → iniciar triagem e registrar movimentações → resolver movimentações intermediárias → concluir a coleta. O material original e a quantidade informada em campo permanecem rastreáveis; a conferência atualiza o valor recebido. Destinar para estoque gera lote rastreável. Cadastrar ou classificar material no catálogo, por si só, não movimenta estoque.

## Backlog entregue

- [x] Resíduos coletados agrupados por coleta, com materiais expansíveis, origem, etapa, conferência e saldo; filas a receber, a conferir, a destinar, concluídas e canceladas.
- [x] Navegação com quatro áreas: resíduos coletados, movimentações e destinações, estoque e lotes, catálogo. Cadastro de material e lote manual são ações dessas áreas; URLs anteriores continuam disponíveis.
- [x] Listagens paginadas no servidor; buscas, filtros e totais por unidade. Quantidades em kg, litros e unidades não são somadas entre si. CSV das novas listas identifica explicitamente a exportação da página atual.
- [x] Conferência em formulário no recebimento; depois de salva, resumo compacto e botão de correção. Histórico sob demanda. Tabela adaptada a cartões em telas pequenas.
- [x] Triagem e novas movimentações exigem recebimento e conferência. Reserva e triagem são intermediárias e impedem encerramento até conversão ou cancelamento. Entradas com saldo zero e movimentação intermediária continuam na fila a destinar.
- [x] Reenvio da mesma criação de destinação devolve a operação existente, sem outro lote; identificador reutilizado com conteúdo diferente é recusado. Edição e cancelamento têm versão e identificação para evitar repetição de auditoria e saldo.
- [x] Cadastro ou seleção de material durante criação e edição de destinação, inclusive conversão de triagem para estoque; busca paginada e unidade compatível. Material passa a integrar o catálogo sem gerar lote antecipado.
- [x] Estoque e catálogo carregam resumos; lotes são consultados ao expandir o material. Cancelamentos ficam separados em histórico. Edição de lote busca somente o registro necessário.
- [x] Listas de destinações não transferem todas as registros completos de auditoria; alterações são consultadas ao abrir o histórico. Distinção visual entre intermediárias, finais e canceladas.
- [x] Lista operacional de coletas paginada, sem baixar conferências e históricos de todas as coletas; detalhes, equipe e incidentes acessados sob demanda.
- [x] Painel operacional com consulta independente dos relatórios pesados, atualização automática e manual, solicitações por origem e operações em campo. Contagem considera agendamentos, O.C.s e PEVs; relatos sobre uma mesma retirada pendente não viram várias retiradas.
- [x] Quantidade de coletas a destinar usa coletas distintas e inclui intermediárias pendentes; totais são separados por unidade.
- [x] Correção do acumulado do gerador após conferência inclusive em coleta sem catador vinculado; coletas não executadas ou canceladas ficam fora da agregação aplicada ao catador.
- [x] Isolamento por cooperativa em todas as novas consultas e classificação; perfis não operacionais são recusados.
- [x] Índices para consultas por cooperativa, etapa, data e lote; unicidade normalizada de novos nomes do catálogo.
- [x] Teste de recorrência da equipe usa data futura em vez de depender de um dia e horário fixos já passados.

## PEVs e duplicidade

Foram validadas retiradas do mesmo PEV no mesmo dia, com entradas separadas de 40 e 30 kg. O comportamento de compartilhar uma coleta entre relatos sobre a mesma retirada ativa é intencional. Reenvio da conclusão com o mesmo identificador não cria outra entrada. Uma nova retirada efetiva tem coleta própria, inclusive quando a anterior aguarda recebimento na cooperativa.

Conferência idêntica, sem alterações, já era tratada sem novo evento; a interface repetia o formulário. O ajuste reduz essa repetição visual. Para destinações parciais, foi adicionada proteção de repetição também no banco e na API.

## Migração e compatibilidade

Migração aditiva: `20261028010000_waste_workspace_integrity`.

Acrescenta identificação e versão das movimentações, nome normalizado de catálogo e índices. Preserva coletas, destinações, quantidades, lotes e auditorias existentes. Nomes historicamente duplicados permanecem com normalização nula; não há fusão nem exclusão automática. Operações antigas não recebem identificadores de criação inventados.

Novas criações de destinação exigem identificador de operação enviado pelo painel atualizado. Publicar API e painel na mesma janela e recarregar o navegador. Novas exigências de conferência se aplicam às operações abertas; registros históricos concluídos não são reabertos. Cancelamento pode regularizar movimentação antiga, respeitando as demais restrições de saldo e encerramento.

## Validação concluída

82 verificações aprovadas: 23 de API do novo fluxo; 10 de interface em desktop e tela de 390 px; 3 de migração sobre dados legados; 11 de equipes; 24 de PEVs; 11 de impacto ambiental. TypeScript, build da API, ESLint dos arquivos JavaScript/JSX alterados e build de produção do painel aprovados.

Cenários incluem reenvios, conflito de versão, saldo, cancelamento, kg e litros, isolamento entre cooperativas, paginação, catálogo durante edição, conferência e recorrência. Execução local com dados descartáveis; sem acesso à VPS nem teste em aparelho físico. O build do painel conserva o aviso preexistente de bundle maior que 500 kB; isso não impede a geração dos arquivos. Detalhamento em `docs/validacao-gestao-residuos-2026-10-28.json`.

## Atualização da VPS pelo responsável

1. Atualizar KatuApp/main; instalar dependências do servidor; gerar Prisma Client; executar `npm run prisma:deploy`; verificar TypeScript e compilar API.
2. Reiniciar `katua-api.service` e conferir estado active.
3. Atualizar Katua_Web/main e compilar painel com `VITE_API_BASE_URL=https://vps.katua.com.br`.
4. Recarregar o navegador e validar uma coleta de teste: receber, conferir, classificar, destinar e concluir.

Esta entrega não altera as telas do App nem exige exportação Expo. Seus endpoints de coletas/PEVs foram exercitados pelos testes de regressão. Não utiliza PM2.
