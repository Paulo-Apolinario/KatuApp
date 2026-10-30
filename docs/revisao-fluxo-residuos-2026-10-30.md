# Revisão do fluxo de resíduos e usabilidade — 30/10/2026

## Resultado da análise

A revisão acompanhou recebimento, conferência, encaminhamento dos materiais, conclusão da coleta, estoque e saída ao destinatário. A coleta, a entrada de material e o lote possuem saldos e etapas diferentes. A tela deve nomear essa diferença: uma entrada com saldo zero pode ter sido totalmente encaminhada para estoque e ainda existir fisicamente no galpão.

Problemas encontrados no código e na interface:

1. O histórico de destinações mostrava o tipo antes/depois mesmo quando o tipo não mudava. Versão e horário de atualização podiam produzir registros repetitivos sem alteração operacional relevante.
2. A lista de resíduos exibia o saldo zero sem informar o encaminhamento/destinatário. Sua consulta descartava as destinações finais e trazia apenas estoque, triagem e reserva.
3. A navegação de lotes destacava uma ligação em texto para edição. Faltava uma operação explícita de saída parcial com destinatário, documentos e trilha própria de estoque. Alterar o status de um lote não descrevia adequadamente a distribuição entre vários destinos.
4. As telas Dados e Dashboard do catador consolidavam todos os materiais em kg. Um registro de óleo em litros recebia quantidade de ranking zero, apesar de a coleta continuar no histórico da API com sua quantidade em litros. O limite de cinco itens no dashboard também podia omitir um material existente.
5. Dados de origem da coleta residencial, unidades repetidas no saldo e campos de origem do lote competiam com ações operacionais na tela.

Nenhum acesso foi feito à VPS ou aos dados de produção. As causas foram verificadas no código e reproduzidas com dados locais descartáveis.

## Fluxo apresentado à cooperativa

| Momento | Ação | Resultado e próxima etapa |
| --- | --- | --- |
| Chegada física | Confirmar recebimento | A coleta é recebida; nenhum destino ou saída é presumido. |
| Conferência | Conferir cada quantidade na unidade original | Quantidade informada em campo e histórico da conferência permanecem preservados. Divergências seguem as validações existentes. |
| Encaminhamento | Destinação direta, rejeito ou descarte | Registra a etapa final daquela quantidade. |
| Encaminhamento | Estoque | Cria lote rastreável. O saldo da entrada diminui; o saldo físico passa ao lote. |
| Encaminhamento | Triagem ou reserva | Mantém o material em acompanhamento e permite posterior conversão. |
| Encerramento operacional | Concluir coleta, com confirmação | Exige conferência, encaminhamento integral, divisão de equipe válida quando aplicável e ocorrências tratadas. Não encerra automaticamente materiais em estoque/triagem/reserva. |
| Estoque | Movimentar lote | Oferece reserva, liberação, processamento, venda/entrega, doação, envio direto e descarte. |
| Saída parcial | Informar quantidade e destinatário | Reduz apenas o saldo do lote e registra a parte entregue. A quantidade original é preservada. |
| Saída total | Encaminhar o saldo restante | Encerra o saldo; o lote permanece acessível em Saídas concluídas com seus destinatários e histórico. |

Venda/entrega neste fluxo registra movimentação física do material, sem controle financeiro, preço ou emissão fiscal. Reserva utiliza o saldo inteiro atual do lote; liberação torna esse saldo disponível novamente. Processamento altera a etapa, preservando quantidade. Saída exige liberação de eventual reserva. Descarte exige justificativa.

## Telas atualizadas

### Histórico de destinação

- Mostra os campos realmente alterados: destinatário, documento, data, observações, tipo e vínculos, entre outros.
- Não repete “destinação direta → destinação direta” como se fosse uma mudança de tipo.
- Salvar sem alteração dos dados operacionais não cria novo evento de auditoria. Os registros antigos não são removidos; quando não houver diferença relevante conhecida, a interface informa isso.
- Exibe três eventos recentes, com opção de expandir os anteriores já retornados pela consulta.
- A edição preserva o instante da data existente quando o dia não foi alterado no formulário.

### Resíduos coletados e entrada de material

- Quando não há saldo sem encaminhamento, mostra na própria linha o destino registrado ou a situação atual do estoque. Destalhes permitem consultar todos os encaminhamentos retornados e documentos.
- Em estoque, informa as saídas recentes, destinatários, quantidades e saldo restante, com acesso ao histórico paginado completo do lote.
- Não inventa destinatário final para triagem, reserva ou estoque aguardando saída. Para registros antigos encerrados sem essa informação, informa a ausência do dado.
- Saldos de vários materiais na mesma unidade são agrupados. Não repete “0 kg · 0 kg”, nem soma kg a litros.
- Solicitações residenciais podem usar o nome do solicitante como origem, e pontos avulsos conservam sua identificação quando disponível.
- A entrada de material distingue situação atual do material do status histórico de ter sido adicionado ao estoque.

### Estoque e lotes

- Botão **Movimentar lote** substitui o acesso discreto em texto para lotes com saldo.
- Ações de movimentação e histórico ficam antes dos dados de cadastro. Dados de origem e armazenamento ficam recolhidos, disponíveis para consulta/edição quando permitida.
- Saídas totais e parciais registram destinatário, documentos opcionais, endereço, data, observações, responsável, saldo anterior e posterior.
- Histórico paginado permanece disponível após zerar o lote.
- Aba **Saídas concluídas** separa lotes vendidos, descartados e destinados do estoque atual e dos cancelamentos.
- Status e processamento passam pelas ações próprias, preservando o histórico. Código, quantidade, unidade e origem ficam protegidos em lotes rastreáveis ou já movimentados.
- Lote antigo com material de catálogo inativo continua podendo sair: a inativação do catálogo não apaga o estoque físico existente.
- Nova situação `DESTINED` representa doações, envio direto e saídas para múltiplos tipos de destino, evitando chamar toda a operação de “vendida”.

### App do catador

Somente as telas Dados e Dashboard do catador foram alteradas, junto de um novo utilitário específico de consolidação. As telas da Cooperativa no App foram preservadas.

- Óleo registrado em litros aparece, por exemplo, como **50 L**, e não como 0 kg.
- Kg e toneladas são consolidados como massa; litros, unidades e m³ mantêm sua unidade.
- Percentuais são calculados dentro da própria unidade. Não há soma ou comparação de kg com litros.
- O resumo mostra as quantidades registradas e o histórico preserva a unidade. O gráfico de evolução continua sendo de peso e não inventa massa para coleta de volume.
- A média de peso considera coletas com peso registrado. Materiais em outras unidades continuam no resumo e na contagem de coletas.
- O dashboard não omite materiais por cortar a lista nos primeiros cinco itens.
- Em equipe, a produção individual continua usando as parcelas confirmadas pela cooperativa; o cálculo não atribui a coleta inteira a cada participante.

## Segurança operacional e dados

Migração aditiva `20261030020000_stock_movement_history`:

- Adiciona `WasteStockMovement`, versão no lote e a situação `DESTINED`.
- Preserva quantidade, unidade, código, saldo e origem dos lotes existentes. Não cria movimentos fictícios para preencher o passado.
- A tabela registra unidade, quantidade, ação, destinatário/documentos, observações, datas, responsável e estados anterior/posterior.
- Há restrições de quantidade, tipos de ação, destinatário obrigatório em saídas e integridade de versão.

Endpoints da cooperativa ativa:

- `GET /waste-stock/lots/:lotId/movements?page=1&limit=20`
- `POST /waste-stock/lots/:lotId/movements`

Gravações utilizam operação identificada por UUID, hash, versão esperada e trava transacional do lote. Repetir a mesma operação não duplica saída. Outra operação com versão antiga é rejeitada. A cooperativa e o lote são validados antes de consultar/gravar. Saldo negativo, saída superior ao saldo, saída de lote reservado, descarte sem motivo e destinatário ausente são bloqueados.

O lote não pode ser reaberto por edição antiga após ser finalizado. A edição/cancelamento da destinação de origem não pode anular um lote que já possui movimentos. A conclusão da coleta, produção do catador e histórico da origem permanecem preservados.

## Casos de uso verificados

| Caso | Resultado esperado/verificado |
| --- | --- |
| Receber e conferir 50 L de óleo | Mantém 50 L e peso 0 sem converter volume em massa. |
| Encaminhar os 50 L ao estoque e concluir coleta | Um lote vinculado; coleta concluída; material ainda em acompanhamento. |
| Reservar/liberar estoque | Quantidade preservada e situação alterada com histórico. |
| Atualizar processamento | Altera etapa, mantém quantidade. |
| Entregar 20 L de um lote de 50 L | Saldo de 30 L, destinatário e responsável registrados. |
| Repetir o envio da mesma operação | Retorna o movimento existente; saldo não é descontado novamente. |
| Tentar duas saídas da mesma versão | Apenas uma é aceita; a outra exige atualizar o lote. |
| Doar/enviar diretamente o saldo restante | Saldo zero e destino preservado; lote aparece em Saídas concluídas. |
| Saídas de tipos diferentes no mesmo lote | Histórico mantém cada quantidade/destinatário; não apresenta tudo como vendido. |
| Quantidade maior que saldo, descarte sem motivo e acesso de outra cooperativa | Operações rejeitadas. |
| Lote de catálogo inativo | Permite a saída do estoque existente. |
| Toneladas, unidades e m³ | Preserva quantidade e unidade sem conversões indevidas. |
| Entrada com destino direto e saldo zero | Mostra destinatário na linha e nos detalhes. |
| Alteração apenas de documento do destino | Histórico nomeia o campo; não simula mudança de tipo. |
| Salvamento sem alteração operacional | Não adiciona evento redundante. |
| Catador com óleo e materiais em kg | Mostra 50 L e massa separadamente; inclui coleta no histórico. |
| Divisão de óleo entre participantes | Produção individual usa a parcela na unidade original. |
| Registros antigos sem destinatário detalhado | Preserva o registro e declara que o destinatário não foi informado. |

## Validação executada

- API: TypeScript e build aprovados.
- App: TypeScript e exportação Expo Web aprovados.
- Painel: ESLint dos arquivos de produção alterados sem erros/avisos e build Vite aprovado; permanece o aviso de tamanho do pacote principal existente.
- 41 grupos de testes de API: operação em campo, conclusão e novos casos de recebimento/estoque/auditoria/unidades, em PGlite descartável.
- 23 grupos de regressão da gestão de resíduos aprovados. Contagens de estoque dos testes agora respeitam o escopo da cooperativa, coexistindo com o lote legado usado para testar a migração.
- Nove grupos de navegador usando API local real, painel e App Expo Web: reserva/liberação, saída parcial/total, edição de observações sem reabertura, arquivo de saídas, destinos na lista, auditoria, largura de 390 px e óleo no catador. Sem erros JavaScript.
- Nove verificações unitárias de consolidação: litros, toneladas, percentuais por unidade, parcelas de equipe e ausência de corte dos materiais.
- Capturas das telas renderizadas foram inspecionadas. Aplicativos nativos não foram instalados ou testados em aparelho nesta execução.

Reprodução:

```bash
cd server
KATUA_VALIDATION_TOOLS=/caminho/ferramentas WASTE_COMPLETION=1 WASTE_USABILITY=1 node tests/field-operations/run.mjs
KATUA_VALIDATION_TOOLS=/caminho/ferramentas KATUA_PANEL_FRONTEND=/caminho/painel/frontend KATUA_APP_DIST=/caminho/export-expo WASTE_USABILITY=1 WASTE_USABILITY_UI=1 node tests/field-operations/run.mjs
node --import tsx tests/waste-usability/material-ranking.ts
```

## Atualização na VPS

Atualizar primeiro API/banco, depois painel e App. Nenhuma ação desta revisão executou migração, deploy ou alteração de dados na VPS.

API e migração:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

App Web:

```bash
cd /var/www/katua/app && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npx expo export --platform web --output-dir dist
```

O export precisa ser servido pela pasta já configurada para `app.katua.com.br`. Gerar `dist` não troca o conteúdo do domínio se o Nginx usar outra pasta; deve-se seguir a configuração existente. O caminho publicado não foi verificado na VPS. Aplicativo nativo instalado precisa receber uma atualização compatível com o processo de distribuição do projeto.

Após publicar: atualizar a página do catador, conferir a unidade do óleo e verificar, no painel, o botão Movimentar lote em um lote disponível. Registrar uma saída parcial real somente quando houver entrega física; conferir o saldo e o destinatário no histórico e na origem. Não é necessário editar ou recriar as coletas antigas para aplicar a correção de apresentação.
