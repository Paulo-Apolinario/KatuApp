# Resumo ambiental automático sem histórico mensal exposto

Data: 27/10/2026. KatuApp e Katua_Web, main.

## Correção solicitada

A configuração por cooperativa havia se tornado requisito para mostrar números, enquanto o App anterior já apresentava uma base simplificada de referência. A exposição dos doze meses também deixou as telas maiores do que o desejado. Esta entrega substitui a apresentação mensal pelo resumo acumulado e restaura o cálculo automático.

## Concluído

- [x] Painel: removidos histórico mensal, tabela de meses, seletor de mês/ano, acumulado anual e exportação mensal da tela de impacto.
- [x] App do catador e do gerador: removidos histórico mensal, botão para abrir histórico, navegação de meses/anos e texto de resultados mensais.
- [x] Mantido resumo compacto de coletas solicitadas, pendentes, concluídas em campo, massa coletada e quatro indicadores estimados.
- [x] Acumulado desde o início dos registros, sem depender do dia ou restringir ao ano atual. Registros de anos anteriores continuam incluídos.
- [x] Base automática anterior do App centralizada na API. Não exige configuração nem cadastro de metodologia pela cooperativa para mostrar o resumo.
- [x] A mesma referência é aplicada no painel e nos Apps do gerador e catador.
- [x] Perfil sem material coletado recebe zero calculado, sem mensagem de configuração obrigatória.
- [x] Solicitações pendentes não geram impacto realizado. O.C.s e agendamentos vinculados são deduplicados na contagem das solicitações.
- [x] Mantido o peso conferido, o tratamento de unidades e a compatibilidade com materiais legados. Somente kg e t são convertidos em massa para a referência; litros, unidades e m³ não são tratados como kg.
- [x] Participação em equipe independe do rateio para o resumo ambiental. Produção individual continua usando as parcelas conferidas. O painel conta cada coleta uma vez.
- [x] Leitura paginada de coletas, sem truncar o acumulado na primeira página ou limitar a 20 mil registros. Cenário com mais de 500 coletas validado.
- [x] Histórico mensal antigo permanece somente no contrato de API com datas explícitas para compatibilidade; não está exposto nestas telas. Teste antigo da interface mensal foi substituído pelos cenários de resumo.
- [x] Configuração de fatores continua opcional para relatórios detalhados; o texto dessa configuração esclarece que ela não é exigida pelo resumo automático.

## Referência operacional restaurada

Versão central: `katua-reference-v1`, em `server/src/modules/impact/impact-summary.service.ts`.

Coeficientes que já existiam na função anterior do App do catador:

| Indicador | Referência por kg coletado |
| --- | --- |
| CO2 estimado | 1,5 kg |
| Água estimada | 35 L |
| Energia estimada | 2,3 kWh |
| Árvores equivalentes | 0,01 |

Exemplo: 100 kg representam aproximadamente 150 kg de CO2, 3.500 L de água, 230 kWh e 1 árvore equivalente segundo essa referência. São aproximações proporcionais à massa, sem diferenciação por material, processo ou destino. Não são fatores oficiais certificados, comprovação de reciclagem, emissões evitadas ou crédito ambiental. A interface identifica o caráter estimado.

## Contrato e etapas

`GET /environmental-impact` retorna o resumo acumulado sem datas e sem exigir fatores. A cooperativa pode usar `generatorId` para restringir ao próprio gerador. A API faz a autorização pelo usuário autenticado.

Concluída em campo significa retirada registrada nos status COLLECTED, RECEIVED, SORTING ou COMPLETED. Não inclui PENDING, IN_PROGRESS ou CANCELLED no peso ambiental. Assim, a informação permanece durante recebimento e triagem e reflete as correções de pesagem. Solicitações sem retirada permanecem apenas na contagem de pedidos.

O resumo não retorna `monthly` ou `year`. O contrato anterior com `year`, `start` e `end` é mantido para compatibilidade de clientes antigos durante a atualização.

## Validação

57 verificações aprovadas: 11 cenários da API de impacto (incluindo compatibilidade do contrato anterior), 18 regras de referência/cálculo/rateio, 8 cenários de interface do resumo, 11 regressões da API de equipes e 9 regressões visuais de equipes e impacto. Incluem ausência de configuração, todos os anos, conferência, unidades, privacidade, participação antes do rateio, deduplicação de solicitações, leitura acima de uma página, ausência de histórico exposto, perfil sem coletas e largura de 390 px.

API/App TypeScript, lint direcionado e builds da API, Expo web e painel aprovados. Inspeção visual em navegador. Nenhuma operação na VPS ou teste em aparelhos físicos. Aviso preexistente de tamanho do pacote Vite permanece independente desta entrega.

## Implantação

Atualizar API e reiniciar `katua-api.service`, compilar painel e exportar App web. Sem migração nova ou variável de ambiente nova. Atualizar os três componentes para substituir as telas mensais antigas. Implantação realizada pelo responsável pela VPS.

## Backlog

- [ ] Homologar em aparelhos Android/iOS físicos.
- [ ] Se for necessário relatório ambiental técnico certificado, validar uma metodologia específica por material/processo/destinação em fluxo distinto do resumo de referência.
