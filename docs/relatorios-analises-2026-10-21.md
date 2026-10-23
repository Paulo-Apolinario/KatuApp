# Relatórios e Análises — 21/10/2026

## Entrega autorizada

Reestruturação das cinco telas do menu Relatórios e Análises, com a mesma linguagem visual da gestão de PEVs e resíduos. A MTR permanece fora desta etapa. Implementação em `main` dos repositórios `KatuApp` e `Katua_Web`; atualização da VPS realizada pelo responsável pelo ambiente.

| Tela | Recursos entregues |
| --- | --- |
| Painel de Indicadores | Indicadores clicáveis, período anterior equivalente, qualidade dos registros, fluxo sem dupla contagem, metas mensais e potencial ambiental configurável, evolução, materiais e mapa dos pontos reais. |
| Coletas | Filtros operacionais, escolha da data de referência, situações completas, quantidades por unidade, paginação, ordenação e conferência individual com datas e destinações. |
| Resíduos | Etapas coletado, recebido, destinado e estoque atual; material/unidade; lotes, processamento, saldo atual e vínculo com a coleta. |
| Equipe | Catadores e motoristas separados por função, execução atribuída, quantidades vinculadas e rotas; sem rateio presumido entre integrantes. |
| Veículos | Coletas vinculadas, capacidade cadastrada, rotas, custos de manutenções concluídas e documentos vencidos ou a vencer em 30 dias. |

Filtros de período, data operacional, rota, origem, PEV, gerador, porte, município, catador, motorista, veículo, situação, material e unidade, conforme a etapa consultada. Busca, paginação e ordenação não alteram os totais do recorte. Há atalhos de datas e filtros salvos no navegador, separados por usuário, cooperativa e tela. A URL permite recuperar o recorte na mesma sessão autenticada. Indicadores não exibem resultados antigos durante falhas ou recarregamentos.

## Critérios de cálculo

- Períodos usam dias civis do Ceará, UTC−3: início inclusivo e dia seguinte ao fim exclusivo. Não se substitui uma data operacional ausente pela criação do registro. Registros sem a data escolhida são informados separadamente, no escopo geral dos filtros, sem atribuição ao período.
- Coletas executadas: `COLLECTED`, `RECEIVED`, `SORTING` e `COMPLETED`. Pendentes e canceladas continuam consultáveis, mas suas quantidades não compõem produção executada. Destinações canceladas não entram nos totais.
- Materiais normalizados são a fonte principal. Somente na ausência deles, um `totalWeightKg` legado explicitamente positivo pode entrar como peso sem classificação. Zero padrão não comprova uma pesagem; zero registrado em material normalizado é preservado.
- Quilogramas, toneladas, litros, unidades e metros cúbicos permanecem separados. Massa equivalente usa somente kg + t × 1.000, sem converter litros ou unidades por estimativas de densidade.
- Coletado, destinado e estoque representam etapas distintas do mesmo fluxo e não são somados como produção adicional. Exemplo: coletar 100 kg e transferir esses 100 kg para estoque não resulta em 200 kg coletados.
- Recebido usa a data de recebimento e as quantidades registradas na coleta: os dados existentes não garantem uma segunda pesagem independente. Destinado usa a data da destinação, independentemente da data da coleta.
- Estoque é a posição atual. O período não reconstrói estoque histórico. Seu total disponível inclui lotes disponíveis/reservados; lotes vendidos/descartados podem ser consultados, mas não compõem o disponível. O saldo pendente também é atual, relativo às entradas das coletas selecionadas.
- Equipe e frota usam os vínculos gravados na coleta. Não se infere autoria histórica pela equipe atualmente associada a uma rota. Os totais gerais da equipe deduplicam coletas vinculadas simultaneamente a motorista e catador; a soma das linhas de funções diferentes pode repetir participação logística.
- Rotas atribuídas usam o agendamento da rota no período; rotas executadas são as distintas vinculadas às coletas selecionadas. Os dois indicadores têm bases diferentes. Não há estimativa de combustível, quilometragem, lucro ou manutenção sem custo cadastrado.
- O mapa utiliza coordenadas cadastradas de geradores/PEVs e da cooperativa. Sem coordenadas, os pontos permanecem na lista. Não calcula trajeto rodoviário; o mapa-base requer OpenStreetMap disponível.
- Metas são configuradas pela cooperativa e comparadas quando há mês completo selecionado, sem filtros operacionais e com data de execução. Não são criadas metas fictícias.
- Potencial de CO2 só é apresentado com fatores cadastrados por material e indicação de nome, fonte e versão da metodologia. O cálculo usa massa coletada com fator aplicável e informa cobertura. Não comprova reciclagem, emissão evitada oficial ou crédito ambiental. Litros, m³ e unidades não entram nesse cálculo.

## API e persistência

Novas rotas autenticadas: `GET /reports/context`, `GET /reports/:kind`, `GET /reports/collections/:id` e `PUT /reports/config`. O servidor determina a cooperativa pelo usuário ativo; IDs informados em filtros não alteram esse escopo. Perfis sem cooperativa autorizada não recebem relatórios. Respostas não incluem CPF, telefone, e-mail pessoal, credenciais ou documentos privados da equipe.

Configurações compartilhadas da cooperativa usam `ReportConfiguration`, com validação de material e controle de versão para evitar sobrescrita concorrente. Filtros salvos são locais ao navegador; não são configurações compartilhadas.

Consultas usam leitura consistente em transação, seleções explícitas de campos e cálculo na API. Até 366 dias por consulta e até 20 mil registros de cada conjunto consultado. Acima do limite a API solicita recorte menor, sem truncamento silencioso. Exportações incluem todas as páginas do recorte admitido.

## Exportações

Excel com abas Resumo, Registros e Metodologia. PDF em paisagem com identificação da cooperativa, filtros, geração, critérios, tabela e paginação. Quantidades são colunas separadas por unidade; ausências permanecem identificáveis. Textos com prefixo de fórmula são neutralizados no Excel. O arquivo exportado segue os filtros aplicados, não alterações ainda não confirmadas no formulário.

## Migração e ordem de atualização

Há uma nova migração aditiva no backend: `20261021120000_report_configuration`. Ela cria somente a tabela de configurações; não altera o histórico de coletas, resíduos, PEVs ou MTR.

1. Atualizar o código do backend, preservando `.env`, uploads e ajustes locais da VPS.
2. Em `/var/www/katua/app/server`, instalar dependências conforme o lockfile, executar `npx prisma generate`, `npx prisma migrate deploy`, `npm run check` e `npm run build`.
3. Reiniciar `katua-api.service` e verificar que terminou em `active`.
4. Atualizar e compilar o painel em `/var/www/katua/frontend/frontend` com as variáveis do ambiente preservadas.
5. Conferir os cinco relatórios com o usuário real da cooperativa e um período com movimentações conhecidas.

A migração e a API precisam estar disponíveis antes do novo painel. Não usar `db push`, `migrate reset` ou registrar esta migração como aplicada sem executá-la. Esta entrega não executou atualização da VPS.

## Validação

- Backend: TypeScript e build de produção.
- Frontend: lint dos componentes e páginas alterados e build de produção.
- API real Fastify/Prisma sobre PostgreSQL embarcado PGlite descartável, com migração incremental a partir do esquema anterior à nova tabela; nenhuma conexão com banco da VPS ou SINIR.
- 12 cenários de integração aprovados: cálculos/migração, paginação/exportação completa, filtros/legado/cancelamentos, datas por etapa/estoque atual, equipe/frota/custos, isolamento/autorização/dados pessoais, entradas inválidas, metas/metodologia/concorrência, cinco telas desktop/gráficos, filtros salvos/detalhes/downloads, cinco telas móveis e recuperação após falha da API.
- Excel baixado e reaberto: 28 registros exportados contra 20 por página na tela. PDF baixado, texto conferido e páginas renderizadas para inspeção visual.
- Fixture de controle: 146 kg + 0,1 t + 7 L = 246 kg equivalentes de massa; lote e destinação de 100 kg separados da produção. Metodologia demonstrativa: 221 kg cobertos × fator 2 = potencial de 442 kg CO2. Esses fatores existem somente no banco descartável dos testes.

Reprodução: `frontend/tests/reports-browser.mjs` no painel e `server/tests/reports/local-server.ts` na API. O runner requer `KATUA_VALIDATION_TOOLS` com PGlite, pglite-socket e Chromium, Playwright disponível e ambos os checkouts locais; usa portas locais 54329/3339/5179. `KATUA_APP_DIR`, `KATUA_PLAYWRIGHT_MODULE`, `KATUA_CHROMIUM_PATH` e `KATUA_VALIDATION_OUTPUT_ROOT` permitem ajustar a estação de teste. A fixture recusa qualquer banco fora de 127.0.0.1:54329. Ferramentas de teste não foram acrescentadas às dependências de produção.

Resultado automatizado: `docs/validacao-relatorios-2026-10-21.json`. O build do painel conclui com aviso de bundle acima de 500 kB; otimização de carregamento permanece no backlog.

## Backlog

### Concluído nesta entrega

- [x] Padronizar cinco telas, navegação, tipografia e cores.
- [x] Centralizar leitura e regras em API de relatórios por cooperativa.
- [x] Separar unidades, datas, etapas e registros sem medição.
- [x] Aplicar filtros a indicadores, tabelas e arquivos; paginar sem perder totais.
- [x] Conferência de registros e mapa dos pontos cadastrados.
- [x] Metas, metodologia configurável e filtros salvos.
- [x] Exportar todas as páginas e validar arquivos reais.
- [x] Validar autorização, isolamento, erro de API e layout móvel.

### Evoluções dependentes de novos dados ou nova etapa

- [ ] Validar com cada cooperativa a fonte e os fatores ambientais antes de configurar uso real.
- [ ] Implantar histórico imutável de movimentações/snapshots para posição de estoque em datas passadas.
- [ ] Registrar combustível, quilometragem, despesas e receitas para análises financeiras e de eficiência verificáveis.
- [ ] Registrar pesagens independentes e participação detalhada por integrante, quando necessárias.
- [ ] Exportação assíncrona para recortes superiores a 20 mil registros, com processamento em lotes e acompanhamento.
- [ ] Agendamento de relatórios e filtros compartilhados entre usuários, caso solicitados.
- [ ] Medir volumes reais de uso para otimizações adicionais de consultas e carregamento do painel.

Pendências de dados não são preenchidas com estimativas automáticas. MTR e sua homologação permanecem na etapa anteriormente pausada pelo responsável.
