# PEVs por cooperativa, impacto dos geradores e equipes de coleta

Data: 27/10/2026. Repositórios: KatuApp (API/App) e Katua_Web (painel). Publicação prevista na main; implantação da VPS pelo responsável.

## Problema e comportamento final

A consulta de pontos públicos permitia que catadores e a tela de consulta de outra cooperativa enxergassem PEVs publicados. Uma coleta em equipe também não possuía participantes registrados nem divisão da pesagem, fazendo o peso integral aparecer apenas no responsável. O impacto do gerador precisava compartilhar a metodologia configurada no painel.

## Entregas concluídas

- [x] `/pev-points`: cooperativas e catadores consultam somente pontos da própria cooperativa, inclusive se públicos. A restrição também vale para criar relatos por ID e consultar protocolos. PF continua podendo encontrar os PEVs publicados, com dados públicos, e encaminhar o pedido à cooperativa responsável.
- [x] Textos da publicação e do App esclarecem o significado de público. A publicação não transfere a gestão nem autoriza outra cooperativa a retirar.
- [x] Abas laterais, navegação das páginas e busca do menu separam motoristas de catadores, preservando URLs anteriores.
- [x] Gestão de Catadores → Equipes: nome, 2 a 30 participantes, edição, situação ativa/inativa, busca e controle de versão. Somente catadores ativos e vinculados à cooperativa podem integrar uma equipe ativa.
- [x] Rota eventual e rota fixa oferecem equipe cadastrada. Sem equipe, mantém-se distribuição individual por ponto. A seleção de equipe preenche os catadores e bloqueia alterações individuais incompatíveis.
- [x] Cada coleta mantém uma cópia dos participantes e do nome da equipe. Editar o cadastro da equipe não altera coletas registradas; roteiros futuros precisam ser revisados explicitamente quando os participantes mudarem.
- [x] Coleta avulsa pendente, sem rota, permite definir/remover equipe em Coleta de Resíduo → Lista → Ver detalhes. Coletas de rota usam a edição do roteiro.
- [x] Participantes da coleta podem visualizar, iniciar, finalizar em campo e registrar ocorrências. A operação continua única, protegida por bloqueio transacional e pelas regras de idempotência existentes; dois aparelhos não geram duas entradas.
- [x] Recebimento → conferência das quantidades → divisão por material. Atalho de divisão igual ou valores manuais, com até três casas decimais, parcelas zero explícitas e justificativa. O arredondamento distribui os milésimos restantes, conservando o total.
- [x] A soma das parcelas precisa coincidir exatamente com a quantidade conferida de cada material, na respectiva unidade. Não mistura litros, unidades ou m³ com kg.
- [x] Divisão grava versão, responsável, data, justificativa e histórico; notifica todos os participantes. Não cria coletas, entradas, lotes ou destinações adicionais.
- [x] Ajustar a pesagem invalida os créditos da divisão anterior até a nova conferência, preservando o histórico. O encerramento de uma coleta em equipe exige divisão correspondente à pesagem atual e continua exigindo as destinações originais.
- [x] Cadastros, produção individual, estatísticas do App e relatório de catadores usam a parcela confirmada. O total da cooperativa e do gerador permanece o peso único da coleta.
- [x] App → Início do catador → Minha produção em equipe: total da coleta, parcela pessoal por material, participantes e situação da divisão. A tela não ocupa uma nova posição na barra inferior.
- [x] Histórico de catadores inclui participações em equipe. PDF da coleta no painel apresenta participantes e parcelas, distinguindo divisão pendente de confirmada.
- [x] App do gerador → Impacto: novo bloco ambiental com período, kg CO2e estimados, massa com fator, cobertura e fonte/versão. O cartão anterior passa a dizer massa consolidada em vez de afirmar que todo material foi reciclado.
- [x] Relatórios e Análises → Impacto ambiental: período, seleção de gerador, indicadores, resultados por gerador e CSV com metodologia, fonte, versão e período. Base: conclusão operacional, limitada a 366 dias e 20 mil coletas por consulta.
- [x] Endpoint ambiental filtra cooperativa e gerador no servidor. Gerador não consulta outro gerador. Metodologia é a já cadastrada em Painel de Indicadores → configuração do relatório.
- [x] Sem fator aplicável, exibe ausência de fator; não inventa redução zero nem coeficientes. Converte apenas t para kg. Valores representam potencial estimado do material consolidado, não comprovação de reciclagem, destinação ou crédito ambiental.

## Exemplo operacional

Três catadores coletam juntos. Em campo são informados 50 kg de papelão. A cooperativa recebe e confere 40 kg. Pode registrar parcelas 13,334 kg, 13,333 kg e 13,333 kg, ou qualquer divisão justificada que some 40 kg. O estoque continua recebendo apenas os 40 kg da coleta, conforme suas destinações; os cadastros recebem as parcelas individuais. Se a pesagem for corrigida para 39 kg, a divisão anterior fica pendente de nova conferência.

## API e banco

Migração aditiva: `20261027030000_teams_material_allocations`. Novas tabelas `CollectorTeam`, `CollectionParticipant` e `CollectionAllocationReview`; campos opcionais de equipe em Route/RoutePlan e controle de divisão em Collection. Não infere equipes retroativamente e não duplica registros legados.

Endpoints autenticados:

- `GET/POST /collector-teams`, `PATCH /collector-teams/:id`.
- `POST /collections/:id/team` (equipe de coleta avulsa pendente).
- `POST /collections/:id/allocate-materials` (divisão após conferência).
- `GET /environmental-impact?start=AAAA-MM-DD&end=AAAA-MM-DD&generatorId=...`.

A equipe cadastrada é um grupo reutilizável. A participação e o rateio pertencem à coleta; os lotes físicos continuam únicos. Não inclui cálculo de remuneração, folha de pagamento ou transferência financeira.

## Validação

52 verificações aprovadas: 11 cenários de integração da API, 8 regras de rateio e gráficos pessoais, 24 regressões das solicitações de PEV e 9 cenários de interface com API real local. Inclui roteiro recorrente, coleta avulsa, acesso por outro vínculo, original 50→40, conferência posterior, crédito individual, notificações, fonte ambiental, cadastro visual, rateio, CSV, barra inferior com cinco abas e largura de 390 px. TypeScript da API/App, lint dos arquivos relevantes e builds da API, painel e Expo web aprovados.

Banco descartável local, sem acesso à VPS. Fatores sintéticos exclusivos dos testes. Não testado em dispositivos físicos; Expo web validado no navegador. O Vite mantém o aviso preexistente de tamanho de pacotes.

## Implantação

Atualizar primeiro KatuApp/API, executar Prisma generate e migrate deploy, compilar e reiniciar `katua-api.service`. Depois atualizar/compilar Katua_Web e exportar App web. Não exige variáveis novas. A migração deve estar aplicada antes de iniciar a nova API. Preservar as configurações locais de ambiente e o host da API na VPS. Nenhuma implantação da VPS foi executada nesta entrega.

## Backlog de continuidade

- [ ] Cooperativa validar metodologia e fatores ambientais reais, com fonte e versão, antes de interpretar kg CO2e. Não há fatores de produção adicionados nesta entrega.
- [ ] Homologar operação compartilhada em aparelhos Android/iOS físicos, incluindo aparelhos simultaneamente offline. O mesmo ponto segue uma operação única; registros conflitantes não são mesclados automaticamente.
- [ ] Se for necessário rateio financeiro, definir regras de remuneração separadas da divisão física por material.
