# Impacto ambiental mensal e geral da cooperativa

Data: 27/10/2026. Repositórios KatuApp e Katua_Web, main.

## Diagnóstico

O resumo ambiental do catador calculava somente o peso coletado no dia. Após a introdução das equipes, passou a usar a produção individual confirmada, que permanece pendente até o rateio. Isso fazia coletas realizadas desaparecerem do resumo ambiental. O novo relatório também estava restrito a geradores e ao status final COMPLETED, excluindo PEVs, PF, avulsas e etapas de campo/recebimento.

## Concluído

- [x] Histórico ambiental por mês, com os doze meses de cada ano, navegação entre anos, mês atual inicialmente selecionado e acumulado anual.
- [x] Painel → Relatórios e Análises → Impacto ambiental: resultado geral de todas as origens da cooperativa, incluindo geradores, PEVs, pessoas físicas e coletas extras aprovadas que originaram coletas. Filtro opcional por gerador permanece disponível.
- [x] App do gerador → Impacto: substituído o recorte antigo e a meta fixa de referência pelo resultado mensal, histórico e acumulado do ano.
- [x] App do catador → Início → Resumo ambiental mensal: considera as coletas das quais participou, inclusive equipe ainda sem divisão. Histórico recolhido inicialmente para manter a tela inicial compacta.
- [x] Produção individual continua baseada na parcela confirmada. Impacto de participação da equipe não deve ser somado entre os integrantes; no painel, cada coleta é computada uma única vez.
- [x] Incluídas etapas COLLECTED, RECEIVED, SORTING e COMPLETED. PENDING, IN_PROGRESS e CANCELLED não geram peso ambiental.
- [x] Mês definido pela data da coleta em America/Fortaleza. Para registros legados sem essa data, utiliza recebimento, conclusão ou criação, com indicação da regra. Receber em outubro uma coleta feita em setembro não a desloca de mês.
- [x] Compatibilidade com materiais normalizados, peso legado explícito e materiais JSON com quantidades/unidades explícitas, sem somar formatos duplicados nem converter litros/unidades/m³ para kg.
- [x] Peso aguardando conferência separado da massa consolidada. Ajustes de quantidade atualizam o mês original e as estimativas correspondentes.
- [x] Agendamentos solicitados e O.C.s têm contagens mensais separadas, incluindo pendências/análise. Uma O.C. pode originar agendamento; por isso essas contagens não são somadas como se fossem solicitações distintas. Quantidades previstas e O.C.s ainda em análise não geram impacto antecipado.
- [x] Metodologia comum ao painel, gerador e catador com fatores por material para CO2e, água, energia e árvores equivalentes. Configuração em Painel de Indicadores → Configurar metas e metodologia.
- [x] Fatores opcionais: ausência de estimativa não é transformada em zero. Cada indicador informa massa com fator aplicável. Removidos coeficientes genéricos diários fixos do catador; não foram introduzidos coeficientes ambientais de produção nesta entrega.
- [x] Fonte e versão da metodologia acompanham os resultados. Estimativa de potencial não comprova reciclagem ou crédito ambiental.
- [x] CSV do painel com doze registros mensais, massa coletada/consolidada/aguardando conferência, quatro indicadores, solicitações, O.C.s e metodologia.
- [x] Isolamento por cooperativa e perfil no servidor. Catador consulta participação própria; gerador consulta somente seu vínculo; filtro de outro gerador é recusado.

## API e histórico

`GET /environmental-impact?year=2026` retorna total do ano, `monthly` com doze registros e grupos por origem. `generatorId` é opcional para a cooperativa. Mantida compatibilidade com `start` e `end`; não misturar ano com datas. Limite de 20 mil registros por consulta e anos de 2000 a 2100 no seletor.

Os registros de coleta existentes permanecem no banco. A apresentação mensal é recalculada com as conferências atuais e a metodologia configurada. Não se trata de fechamento mensal imutável nem inventário de emissões certificado. Não há tabela mensal nova ou migração nesta entrega.

## Validação

41 verificações aprovadas: 6 cenários de integração da API mensal, 7 regras de cálculo/calendário/compatibilidade, 8 regressões de rateio, 11 cenários da API de equipes e 9 cenários reais de navegador. Incluem virada de mês no fuso de Fortaleza, ausência de fatores, unidades, legado JSON, cancelamentos, peso previsto, participação antes do rateio, conferência no mês original, fontes sem gerador, troca de mês/ano, CSV, configuração dos quatro fatores e telas em 390 px.

API, App TypeScript, lint direcionado e builds da API, painel Vite e Expo web aprovados. Banco local descartável; sem acesso à VPS ou teste em aparelhos físicos. O aviso preexistente de pacote grande do Vite permanece independente desta entrega.

## Implantação

Atualizar API e reiniciar `katua-api.service`, compilar painel e exportar App web. Sem migração ou variável de ambiente nova. A implantação da VPS é realizada pelo responsável; nenhuma alteração foi aplicada à VPS nesta entrega.

## Backlog

- [ ] Cooperativa preencher/validar fatores reais com fonte e versão, inclusive água, energia e árvores quando houver metodologia aplicável.
- [ ] Homologar a apresentação em aparelhos Android/iOS físicos.
- [ ] Definir política de fechamento mensal, se forem necessários registros históricos imutáveis com metodologia congelada. O histórico atual reflete as conferências registradas.
