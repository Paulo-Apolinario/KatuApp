# SINIR — autenticação, catálogos e preparação dos modelos — 20/10/2026

> Continuação: [códigos com (*) e identificação de perigo](sinir-residuos-perigosos-2026-10-20.md), com novos campos, revisão e testes.

## Resultado e limites

Continuação da central ambiental publicada em `docs/central-ambiental-sinir-2026-10-20.md`. O Swagger oficial foi localizado e revisado. Esta atualização entrega um **conector de autenticação e leitura**, configuração privada por unidade, seleção de catálogos no painel e projeção local dos modelos de MTR/MTR-LR/CDF. Não habilita emissão, recebimento, cancelamento ou alteração de documentos oficiais.

A emissão permanece bloqueada no código, inclusive quando a autenticação funcionar ou `SINIR_ENVIRONMENT` estiver definido como HOMOLOGATION/PRODUCTION. A rota de envio continua recusando com `503 INTEGRATION_UNAVAILABLE`. O Swagger não identifica explicitamente um endereço separado para testes. Não houve autenticação real com o token do usuário, transmissão ao SINIR nem alteração na VPS.

## Entregue

### Backend

- Troca do token de integração por token de acesso em `POST /token`, header Bearer. Credenciais ficam apenas no backend; respostas públicas nunca incluem token. Não utiliza os antigos `/gettoken` e `/autenticar`.
- Cache de acesso em memória até oito horas, reduzido se o JWT informar expiração anterior, com margem de um minuto. A claim é usada apenas para reduzir cache, sem tratá-la como prova independente de autorização. Reinício do serviço elimina o cache.
- Autenticação concorrente compartilha a mesma solicitação. Em leitura com HTTP 401, renova e repete uma única vez; 401 persistente limpa o estado autenticado. Nenhuma operação de escrita de negócio é repetida ou executada.
- Verificação explícita de conexão consulta o catálogo de unidades mesmo com token em cache. Não testa permissão para emitir MTR/CDF nem comprova ambiente de homologação.
- Respostas HTTP 200 com sinalização de erro são rejeitadas. Falhas de rede, timeout, JSON inválido, estrutura de catálogo desconhecida e respostas excessivas têm mensagens locais, sem refletir respostas remotas sensíveis.
- Requisições HTTPS restritas a hosts SINIR e caminho base `/api`, sem redirecionamento. Timeout de 15 segundos por requisição; respostas limitadas a 8 MiB. Endereço de homologação com outro caminho exige ajuste explícito após confirmação oficial.
- Catálogos de resíduos, unidades, classes, estados físicos, acondicionamentos, tratamentos e sistemas LR; filtros oficiais de classe por resíduo e acondicionamento por estado físico. Cache de catálogos por dez minutos em memória, sem persistência no navegador.
- Apenas campos conhecidos dos catálogos são repassados. Estruturas incompatíveis produzem erro e precisam ser conferidas contra resposta real. O Swagger usa envelope genérico e não descreve por completo todos os itens dos catálogos.
- Uma credencial por instalação nesta etapa, vinculada explicitamente a ID local, CNPJ e código oficial da unidade. Toda chamada exige acesso de edição à unidade e coincidência com esse vínculo. Credencial de uma unidade não fica disponível automaticamente para as demais cooperativas ou para gestores que só consultam compartilhamentos.

### Painel e formulários

- Em “Unidades e integração”, botão de verificar autenticação, configuração por unidade, ambiente declarado e horário da última verificação/autenticação. Não há formulário de senha Gov.br ou token no navegador.
- Carregamento explícito dos sete catálogos na edição de documento. Campos passam a oferecer seleção por código oficial; classes e acondicionamentos usam consultas dependentes. Catálogos grandes têm busca e exibem até 200 opções, preservando a opção selecionada.
- Na ausência de catálogo, permite preparar códigos manualmente, com indicação de que ainda precisam ser conferidos. Falha de consulta não apresenta dados antigos como uma atualização bem-sucedida. Ausência de opção no catálogo é indicada na seleção preservada.
- Unidade física do KATUÁ e código oficial de unidade de medida são campos distintos. Não presume que KG, TON ou LITER correspondam a determinado número nem converte massa/volume. Conferência da equivalência continua necessária.
- MTR regular/origem: identificação dos participantes, armazenador temporário condicional, resíduos e campos de origem no PEV. Código IBAMA passa a aceitar forma alfanumérica de preparação; somente o catálogo/validação oficial confirma códigos vigentes.
- Dados conhecidos de PEV importados da coleta incluem identificação, CEP, logradouro, número, bairro e UF. Não inventa IBGE, CNPJ ou coordenadas para a API. Coordenadas continuam na gestão de PEVs, sem supor que o contrato MTR as aceite.
- MTR-LR Processo: grupos com número do manifesto de origem, referência do resíduo e seus materiais, sistema LR e chave de NF-e quando informada. Dados antigos de materiais e referências permanecem preservados, exigindo reorganização explícita em grupos. Não associa resíduos automaticamente por nome.
- CDF: geradores associados com CPF/CNPJ e unidade oficial, manifestos recebidos e período. Registro profissional e descrição de tratamento continuam como controles internos, sem presumir campos equivalentes no SINIR.
- Botão “Conferir dados para integração”: prévia JSON da versão salva, pendências e advertências; não altera estado nem chama API externa. Rejeita versão divergente e não fica disponível para usuários sem acesso de edição. Edições não salvas exigem salvar antes de conferir.
- Rascunhos antigos recebem novos campos vazios ao editar; não há migração destrutiva de payloads. Aprovação interna continua distinta de validação oficial e compatibilidade integral com catálogos.

## Modelos e divergências documentadas

| Operação | Modelo usado na prévia | Conferência necessária |
| --- | --- | --- |
| MTR regular / LR origem | Array de `ApiwsManifestoDTO`, participantes `{cpfCnpj, unidade}`, resíduos com códigos e quantidade | Conferir permissões, obrigatoriedade condicional e códigos oficiais. Campos de PEV dependem da modalidade aplicável. |
| MTR LR processo | Array de `ApiwsManifestoProcessoDTO`, `listaManifestoResiduosOrigem`, `numeroManifestoOrigemProcesso`, `residuoReferencia`, `listaManifestoResiduosProcesso` e `chaveNF` | Confirmar referência exata retornada pela origem e regras do sistema LR. Não reutiliza o array de resíduos do MTR regular. |
| CDF | `ApiwsCertificadoDestinacaoDTO`: `listaManifesto` com objetos `manNumero`, `listaParceiroGerador`, `cerDataInicial`, `cerDataFinal`, `cnpjDestinador`, `parceiroDestinador` | O exemplo textual mostra outro formato. O schema foi priorizado para preparação, mas o comportamento precisa ser confirmado em homologação. |

Datas civis são projetadas em timestamp de milissegundos a partir de meia-noite UTC-3 (Fortaleza), sem depender do fuso da máquina. Confirmar interpretação de datas pelo serviço em homologação. Número de NF é referência interna; informar chave não emite NF-e.

Também foram identificados exemplos divergentes nos nomes de campos de recebimento e envelopes de retorno. Consulta de manifestos documenta paginação iniciada em zero e janelas de até 30 dias. Downloads, recebimento, correções e cancelamento constam do Swagger, mas ficam no backlog: não são acionados por esta entrega. Não foi encontrado mecanismo explícito de idempotência no contrato; emissão com timeout não poderá ser simplesmente reenviada.

## Configuração na VPS

Atualizar API e painel pelos repositórios `main`, preservando `.env`, evidências e os ajustes locais. **Esta continuação não acrescenta migração.** Caso a entrega anterior ainda não tenha sido instalada, continua sendo necessário aplicar `20261020160000_environmental_workspace` antes de usar a central. Não há implantação automática na VPS nesta entrega.

As variáveis estão documentadas em `server/.env.example`, com credencial vazia:

| Variável | Valor / orientação |
| --- | --- |
| `SINIR_ENABLED` | `false` por padrão; mudar para `true` somente após configurar credencial e vínculo. |
| `SINIR_ENVIRONMENT` | `UNCONFIRMED` inicialmente. HOMOLOGATION/PRODUCTION são declarações do responsável e não habilitam emissão nem mudam a URL automaticamente. |
| `SINIR_BASE_URL` | `https://admin.sinir.gov.br/api`, conforme host/basePath do Swagger; não identificado como sandbox. |
| `SINIR_INTEGRATION_TOKEN` | Token de integração vigente no `.env` privado da API, sem prefixo Bearer. Não colocar no Git, frontend, VITE_, documento ou captura de tela. |
| `SINIR_LOCAL_UNIT_ID` | Identificador exibido na seção de conexão da unidade da central. |
| `SINIR_UNIT_TAX_ID` | CNPJ da unidade autorizada, somente 14 dígitos. |
| `SINIR_OFFICIAL_UNIT_CODE` | Código da unidade no SINIR, correspondente ao cadastro e à credencial. Não é código IBGE nem ID local. |

Após configurar, compilar/reiniciar a API com `katua-api.service`, atualizar o painel e verificar a conexão na unidade correta. O vínculo configurado protege o isolamento local; não prova, por si só, que o token pertence à unidade informada ou que a organização pode emitir. Confirmar isso no SINIR e nos testes autorizados. A credencial compartilhada na conversa não foi gravada no repositório ou aplicada à VPS.

## Validação

- 10 testes do backend com respostas simuladas: concorrência, Bearer, cache, renovação, recusa persistente, erros de negócio, vínculo entre organizações, limite de resposta, modelos de MTR/LR/CDF e compatibilidade com rascunhos antigos.
- 31 testes unitários do painel, incluindo preservação de rascunhos antigos e importação de dados do PEV.
- 12 cenários integrados com Fastify/Prisma reais, PGlite e Chromium, sem chamadas autenticadas ao SINIR. Incluem os fluxos anteriores da central, novas permissões/versões, falha de configuração explícita e criação de grupos LR pelo painel.
- A seleção positiva de catálogos no navegador usa respostas fictícias interceptadas; a autorização das novas rotas é testada contra a API real local. Isso não constitui homologação dos catálogos do SINIR.
- TypeScript, lint dos arquivos alterados e builds da API/painel. O aviso preexistente de chunks grandes do Vite permanece.

Resultados: `docs/validacao-sinir-api-2026-10-20.json`. Nenhum token real aparece em testes ou resultados. Fixtures são fictícias e locais. PGlite não substitui a validação no PostgreSQL da VPS.

Reprodução backend, em `server`: `node --import tsx --test tests/environmental/sinir.test.ts`. Painel, em `frontend`: `node --test tests/*.test.mjs`. O teste `frontend/tests/environmental-browser.mjs` usa o ambiente local descartável e as variáveis de ferramentas descritas no script.

## Backlog atualizado

| Prioridade | Item | Situação |
| --- | --- | --- |
| P0 | Confirmar sandbox/homologação e credencial exclusiva | Pendente de resposta oficial. Nome do token não caracteriza ambiente de teste. |
| P0 | Configurar unidade/credencial e validar autenticação real | Código entregue; configuração e validação externa pendentes na VPS, sem exposição de segredo. |
| P0 | Conferir catálogos e divergências de contrato com respostas reais | Leitura implementada; confirmar todos os envelopes/campos e equivalência das medidas. |
| P0 | Homologar escrita de MTR regular, LR origem/processo e CDF | Prévia local entregue; transmissão bloqueada até testes autorizados e confirmação de contratos/permissões. |
| P0 | Identificação de tentativas e prevenção de duplicidade | Antes de emitir: persistir tentativa, resultado por item, número oficial, falha ambígua e reconciliação. Não repetir emissão automaticamente após timeout. |
| P1 | Consulta e sincronização de manifestos oficiais | Implementar janela de até 30 dias, paginação, permissões e associação ao documento interno sem presumir identidade de organizações. |
| P1 | Download e armazenamento de documento oficial | Implementar confirmação de formato, autorização, arquivo privado e hash; resolver discrepâncias do Swagger, especialmente CDF PDF/XML. |
| P1 | Recebimento e divergências | Conferir schema real, permissões de destinador/armazenador, alteração e aceite do gerador. Não modificar estoque automaticamente sem conciliação. |
| P1 | Cancelamento oficial | Implementar regras e justificativa após homologação; arquivamento interno não cancela manifesto oficial. |
| P1 | Múltiplas credenciais | Uma por instalação agora. Evoluir para cadastro seguro por organização/unidade com gestão de acesso e rotação, sem tokens no frontend. |
| P1 | Declaração municipal | Swagger MTR não documenta essa API; confirmar canal específico. Seis etapas de preparação continuam disponíveis. |
| P2 | Robustez operacional | Medir limites oficiais, acrescentar observabilidade sem dados sensíveis, validar acessibilidade e coleta de diagnóstico com usuários do piloto. |

## Origem da especificação

- [Swagger oficial](https://admin.sinir.gov.br/api/swagger-ui.html).
- [Definição Swagger 2.0 usada pela interface](https://admin.sinir.gov.br/api/v2/api-docs), consultada em 20/10/2026: 34 caminhos e 26 modelos. Com `Accept: application/json`, a definição foi obtida em JSON.
- SHA-256 do JSON normalizado consultado: `50e022c6ade46d84dfaf4373cb98ff671ceea80aed1e9c0a1c62630214df41a8`.
- [Página oficial MTR e suporte](https://sinir.gov.br/sistemas/mtr/): `mtr.sinir@mma.gov.br` para confirmar ambiente, habilitação e contratos. Nenhuma mensagem foi enviada ao suporte por esta entrega.
