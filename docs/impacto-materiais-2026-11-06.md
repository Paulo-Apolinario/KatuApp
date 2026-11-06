# Identificação dos materiais e impacto ambiental

## Comportamento

O catálogo preserva nomes comerciais e passa a aceitar `technicalProfile`: composição padronizada, apresentação, cor, origem/processo, identificação declarada ou conferida, evidências, contaminantes, edição/classe ABNT, documentação e códigos com lista e versão. Nenhuma composição ou classe é deduzida de nomes, cores ou categorias. A classificação antiga em `wasteClass` permanece histórica; não há conversão automática para a edição 2024.

Novas coletas capturam a identificação do catálogo como **declaração**, mesmo quando o catálogo informa composição conferida. Não se presume que o registro específico da coleta foi tecnicamente conferido. `PUT /environmental-impact/materials/:id/identification` permite à cooperativa proprietária revisar a identificação com concorrência otimista (`expectedUpdatedAt`) e reenvio idempotente (`operationId`). Preserva a declaração e o histórico das revisões. Quantidade e composição têm conferências distintas.

`GET /environmental-impact` usa um único mecanismo para acumulado, ano e intervalo. Filtros opcionais: `year`, ou `start/end` (até 366 dias), `generatorId`, `materialId`, `materialCode`, `stage=ALL|CONFIRMED|PROVISIONAL`. Datas civis seguem Fortaleza; registros legados explicitam o uso de recebimento, conclusão ou criação. Paginação interna de 500 coletas, sem corte de totais em 20 mil. A lista de rastreabilidade limita somente sua amostra recente a 50; os totais permanecem completos.

As estimativas requerem quantidade conferida (`quantitiesReviewedAt`), identificação conferida na coleta, fator para o item **e para a mesma composição**, metodologia validada pela cooperativa com responsável, fonte, versão, região, cenário e vigência. Sem isso, o valor é `null`, nunca um coeficiente genérico ou zero presumido. Zero explicitamente documentado é válido. Valores negativos de CO2e podem representar resultado desfavorável. Árvores equivalentes se restringem a papel/papelão e fator informado. Misturas, eletrônicos e rejeitos não recebem automaticamente fatores de um constituinte.

Unidades são preservadas; apenas toneladas são normalizadas para kg. Litros, unidades e m³ permanecem nas quantidades físicas e fora dos fatores por kg. Não há fatores técnicos de produção pré-preenchidos. Coeficientes de testes são fictícios e existem apenas no banco descartável.

Saídas externas utilizam movimentações físicas, não a quantidade de documentos ou referências da O.S. Transferências internas STOCK/TRIAGE não são novas saídas. Destinações canceladas não compõem os totais. O filtro de período das saídas utiliza a data de destinação, independentemente da data da coleta. O saldo exibido é **atual**, inclui reservas e não representa saldo histórico no fim do período. Venda ou documento informado não comprovam reciclagem. Os indicadores continuam sendo potenciais estimados da coleta, separados das saídas e sem somar ambas as etapas como novos benefícios.

A metodologia é preservada em revisões de `ReportConfigurationRevision`, junto do autor e configuração usada. Exportações incluem filtros, fontes, revisão, período e limitações. A versão exibida de uma configuração atual não transforma o relatório em certificação ou crédito de carbono.

## Compatibilidade e implantação

Migração aditiva `20261106140000_material_identification`: dois campos JSONB opcionais e tabela de revisões. Preserva os dados existentes e copia a configuração atual para o histórico. Aplicar com `prisma migrate deploy`; gerar o cliente Prisma e reconstruir o backend. Atualizar backend antes do novo painel.

O componente ambiental do app foi ajustado para aceitar estimativas nulas e mostrar litros. Distribuir essa atualização do app antes de ativar o novo contrato do backend para usuários com versões antigas: o componente antigo esperava números e não sabia representar ausência de fator. Não foi gerado APK nem executada implantação na VPS.

A rota continua restrita a contas ativas e vínculos da cooperativa; catadores só veem participação e geradores só sua origem. Nenhuma rotina altera quantidades, lotes, documentos emitidos ou cria uma destinação a partir desta tela.

## Validação

- 16 casos de cálculo/identificação, 3 contratos de ausência/abrangência.
- 14 verificações Fastify/Prisma em PostgreSQL descartável: persistência, revisão/idempotência/concorrência, isolamento, filtros combinados, duas origens, litros, mais de 500 coletas, mudança de ano, saídas parciais, saldos e revisão imutável da metodologia.
- Migração SQL executada contra estrutura sem os campos/tabela novos.
- 5 verificações de calendário e unidades no frontend; 12 verificações de interface Playwright, incluindo filtros, exportações PDF/Excel, formulário técnico e viewport de 390 px.
- TypeScript e build do backend; build e lint direcionado do painel.

Para repetir os testes, usar exclusivamente banco local descartável. `tests/impact/integration.ts` exige `KATUA_LOCAL_VALIDATION=1` e DATABASE_URL local na porta 54329. Os scripts de integração antigos em impact-monthly/impact-summary registram contratos de versões anteriores; a validação desta revisão está em tests/impact.
