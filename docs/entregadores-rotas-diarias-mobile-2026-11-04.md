# Entregadores avulsos, resultado diário e painel no celular

Entrega em 04/11/2026. App Web, painel e servidor; sem builds Android/iOS.

## Diagnóstico e mudanças

Antes desta entrega, nome/documento/telefone da origem existiam somente no registro individual da entrada. Não havia cadastro reutilizável para a próxima entrega. Rotas recorrentes por dias da semana, pontos por endereço e coleta por bairro já existiam. O encerramento parcial preservava o material coletado e a recorrência, mas a apresentação agrupava cancelados e não atendidos. O login mantinha duas colunas em largura móvel mesmo com a ilustração oculta, estreitando os campos.

## Cadastro simplificado

Painel → Coleta de Resíduo → Entregadores avulsos. Também é possível cadastrar ou selecionar a pessoa dentro de Receber material na cooperativa.

- Nome obrigatório; CPF e telefone opcionais. CPF, quando informado, valida dígitos verificadores e é único por cooperativa. Telefone com DDD, sem obrigatoriedade.
- Nome não é único: homônimos podem ter cadastros diferentes. A busca aceita nome sem acento, CPF ou telefone.
- Não cria conta no App, cadastro de catador, cadastro de gerador ou produção de colaborador.
- Cada recebimento tem registro independente, com FK para a pessoa e cópia dos dados da origem naquele momento. Editar nome/telefone/CPF não reescreve entradas anteriores.
- Histórico paginado consulta entregas da pessoa e permite abrir o registro e seus encaminhamentos. Os recebimentos antigos não são vinculados automaticamente por semelhança de nome ou documento.
- Entrega sem identificação e preenchimento avulso continuam disponíveis. CPF não é exigido para receber o material.
- A pessoa é cadastrada antes de concluir a entrega. Enquanto o formulário desse cadastro está aberto, o envio do recebimento fica bloqueado para evitar criar entrada anônima por engano.
- Recursos são restritos à cooperativa autenticada. Cadastro de outra cooperativa não pode ser selecionado, editado ou consultado no histórico.

`IntakeDeliverer` contém identificação mínima, versão, autor de criação/edição e datas. Criação usa UUID de operação e hash; repetição não duplica pessoa. Edição verifica versão. O recebimento verifica a versão da pessoa selecionada e grava a origem no mesmo fluxo transacional já utilizado pela entrada avulsa.

Endpoints: `GET/POST /intake-deliverers`, `PATCH /intake-deliverers/:id`; `/material-intakes` recebe `delivererId` e `delivererVersion` e permite filtrar por `delivererId`.

## Rotas diárias e dez pontos

As rotas fixas continuam usando o mesmo planejamento. Há atalhos explícitos para todos os dias ou segunda a sexta, mantendo a possibilidade de escolher outros dias. A modalidade por área permite descrever bairro/ruas e cadastrar casas, geradores, PEVs ou endereços avulsos. Cada data gera sua própria execução e seus próprios atendimentos.

No caso de dez pontos com oito coletas realizadas:

1. A equipe registra as oito coletas normalmente.
2. Pontos não atendidos podem receber relato de motivo; a cooperativa confirma o encerramento do dia.
3. Os dois restantes recebem `attendanceOutcome = NOT_COLLECTED` e aparecem como **Sem coleta no dia**. O motivo, o responsável e a data da decisão permanecem no histórico.
4. As oito coletas realizadas, os materiais, a produção e os comprovantes ficam preservados.
5. A programação do dia seguinte conserva seus dez pontos. Não é criado saldo/material para os dois não coletados.

O marcador distingue ausência de coleta da apresentação de cancelamento genérico, preservando o status interno `CANCELLED` para compatibilidade com o ciclo existente. Cancelamentos antigos não são reinterpretados automaticamente. Reagendamento continua sendo uma decisão explícita, não uma transferência silenciosa dos pontos para outro dia.

Não há encerramento automático por relógio ou simples ausência de envio: a decisão é confirmada pela cooperativa para respeitar trabalhos ainda salvos offline. A geração continua no horizonte recorrente já existente; esta entrega não cria um módulo paralelo de rotas.

## Celular

Login com uma coluna abaixo de 992px, campos de largura integral, botões de toque, fonte de entrada de 16px para evitar zoom automático de formulário e rolagem sem altura fixa que corte o conteúdo. Desktop conserva duas colunas. Acesso por senha, exibição da senha, link rápido e recuperação permanecem disponíveis.

O painel autenticado recebe ajustes de espaçamento, cabeçalhos, campos e botões em telas menores. Tabelas largas conservam rolagem no próprio contêiner. Menu fecha na navegação e por Escape; a rolagem da página é restaurada ao fechar.

## Migração e atualização

Migração aditiva `20261104010000_intake_deliverers_daily_outcome`: nova tabela, vínculo opcional na entrada e marcador opcional de resultado. Registros e recorrências anteriores são preservados.

Servidor:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

App Web, para a identificação dos pontos sem coleta na execução:

```bash
cd /var/www/katua/app && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
```

## Validação

Banco/API descartáveis e Chromium real, sem dados de produção. Casos: dados opcionais, duplicidade/validação de CPF, pesquisa, isolamento entre cooperativas, versão concorrente, histórico imutável, anonimato preservado; execução de dez casas com oito coletas e duas sem coleta, seguida de nova execução com dez pontos; login em 320/390px, paisagem e desktop; reutilização do cadastro na segunda entrega, edição de telefone, menu móvel e atalhos de frequência. Contagens e resultados no arquivo JSON desta entrega.
