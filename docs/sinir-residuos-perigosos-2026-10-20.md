# SINIR — códigos IBAMA com (*) e identificação de perigo — 20/10/2026

## Entrega

Continuação de `integracao-sinir-api-2026-10-20.md`, autorizada após análise do repositório de referência apresentado pelo usuário. Backend e painel passam a preservar códigos IBAMA terminados em `(*)` e preparar densidade, número ONU, classe de risco, nome de embarque e grupo de embalagem. A autenticação continua usando `POST /token`; emissão, recebimento, cancelamento e demais escritas no SINIR permanecem bloqueados.

Não foram copiadas tabelas do repositório de terceiros para produção, fixados códigos de unidade no produto, utilizadas credenciais reais ou alterada a VPS. Os testes positivos de API externa e catálogos continuam simulados.

## Alterações

- Código IBAMA: validação compartilhada aceita o identificador com o sufixo literal `(*)` no final, dentro do limite de 20 caracteres. Preserva o valor integral no rascunho, consulta de classe por resíduo e prévia JSON. Continua rejeitando barras, query strings, sufixos arbitrários e caminhos manipulados.
- Consulta de acondicionamento mantém filtro exclusivamente numérico. Nenhum filtro pode mudar a rota de destino ou acessar um endpoint arbitrário.
- Novos campos por resíduo: `density`, `unNumber`, `riskClass`, `shippingName`, `packingGroup`. Disponíveis tanto no MTR regular/LR de origem quanto nos grupos de resíduos de MTR-LR de processo.
- Prévia projeta os valores informados em `marDensidade`, `marNumeroONU`, `marClasseRisco`, `marNomeEmbarque`, `marGrupoEmbalagem`. Dados vazios opcionais são omitidos da projeção. Não altera quantidade, converte massa/volume, gera documento oficial ou confirma autorização de transporte/destinação.
- Densidade aceita rascunho vazio ou zero, preservando a diferença: vazio significa desconhecido; zero não atende à conferência. Valores negativos, não finitos ou acima do limite do campo são rejeitados. A revisão interna exige densidade positiva para unidade física LITER/CUBIC_METER, ou quando o campo já tiver sido preenchido. Não assume a unidade da densidade nem calcula massa; conferir isso com o contrato/ambiente oficial.
- Código com `(*)`, ou preenchimento de qualquer campo de perigo, exige completar os quatro campos de identificação para a revisão interna. Essa é uma regra conservadora de preparação do KATUÁ, não afirmação de que todo resíduo marcado tenha classificação de transporte ou número ONU automaticamente dedutíveis.
- Informações técnicas de perigo não são inferidas pelo nome, classe do resíduo ou código IBAMA. Quando a classificação aplicável não estiver clara, conservar o documento como rascunho e confirmar as regras com o responsável técnico e o SINIR.
- Formulário apresenta os campos com orientação contextual, incluindo no celular. A lista de unidades também exibe `uniDescricao` quando retornada pelo catálogo.
- Rascunhos antigos recebem campos novos vazios ao editar; materiais de processo e valores existentes são preservados. Não há migração de payloads nem alteração automática de registros. Uma revisão anterior não comprova atendimento aos novos campos; reabrir e conferir antes de eventual integração futura.

## Validação

- 14 testes de backend aprovados: testes anteriores do conector e das projeções, além de códigos `(*)`, consultas dependentes, bloqueio de manipulação de URL, identificação de perigo em MTR e LR Processo, densidade vazia/zero/positiva e preservação de quantidade/unidade.
- 32 testes unitários do painel aprovados, incluindo compatibilidade de rascunhos antigos e materiais dentro de grupos.
- 13 cenários integrados de API Fastify/Prisma real local, PGlite e Chromium: inclui persistência dos campos, bloqueio da revisão com pendências, revisão após preenchimento, seleção de catálogo simulado com `(*)`, prévia e apresentação móvel a 430 px sem transbordamento horizontal.
- TypeScript, lint dos arquivos alterados e builds da API/painel aprovados. Permanece o aviso preexistente de chunks grandes do Vite.

Resultados em `validacao-sinir-perigo-2026-10-20.json`. Fixtures e identificações técnicas são fictícias: não devem ser usados para transporte ou emissão. Nenhum teste constituiu autenticação real no SINIR ou homologação externa. O banco local de testes não substitui a validação no PostgreSQL da VPS.

## Atualização na VPS

Atualizar API e painel a partir da `main`, preservando `.env`, arquivos privados e ajustes locais. **Esta etapa não acrescenta migração de banco.** Se a central inicial ainda não estiver instalada, aplicar a migração `20261020160000_environmental_workspace` da entrega anterior. O arquivo `server/src/server.ts` não foi modificado. Reinício da API continua por `katua-api.service`, sem PM2.

A configuração privada e o vínculo de credencial permanecem os descritos no documento anterior. Nome do token ou seleção de HOMOLOGATION não habilitam emissão nem comprovam ambiente de teste.

## Backlog atualizado

| Prioridade | Item | Situação |
| --- | --- | --- |
| Concluído | Códigos com (*) e consulta de classes | Preservação e validação implementadas, incluindo caminho da API. |
| Concluído | Densidade e identificação de perigo | Cadastro, persistência, revisão interna e projeção local implementados. |
| P0 | Homologação oficial | Confirmar URL atual, unidade de teste, credenciais e separação dos documentos de produção. |
| P0 | Regras condicionais oficiais | Confirmar unidade da densidade, situações em que ONU/grupo de embalagem se aplicam, respostas por modalidade e regras para resíduos sem classificação de transporte. Não deduzir esses dados. |
| P0 | Catálogos atuais e permissões | Validar respostas autenticadas atuais, códigos e equivalência de medidas. Listas coletadas por terceiros não substituem catálogo oficial vigente. |
| P0 | Escrita e prevenção de duplicidade | Permanecem pendentes: emissão, rastreio de tentativas, reconciliação após timeout e testes autorizados. |
| P1 | Fluxos seguintes | Permanecem no backlog anterior: consulta/sincronização de manifestos, documentos oficiais, recebimento, correção, cancelamento e múltiplas credenciais. |

## Referências e limites

- [Swagger oficial](https://admin.sinir.gov.br/api/swagger-ui.html) e sua [definição](https://admin.sinir.gov.br/api/v2/api-docs): os modelos incluem os cinco campos técnicos projetados nesta entrega. A declaração de campos nos modelos não define, sozinha, todas as regras condicionais.
- [Repositório analisado](https://github.com/lrmconsulting/api-sinir-mtr): referência secundária fornecida pelo usuário, com dados que o autor informa ter coletado em junho de 2026. Não é especificação oficial vigente nem uma dependência adicionada ao KATUÁ.
- O `openapi.json` desse repositório aponta `https://homolog-admin.sinir.gov.br/apiws/rest` como candidato a homologação, com confirmação pendente. A consulta pública anterior recebeu HTTP 503, sem comprovar disponibilidade ou adequação ao fluxo atual. A URL não foi aplicada à configuração do produto.
- A autenticação antiga `/autenticar`/`gettoken` descrita nesse repositório não substitui o fluxo atual `POST /token`. O exemplo de CDF também diverge do modelo oficial, motivo pelo qual não foi copiado.
