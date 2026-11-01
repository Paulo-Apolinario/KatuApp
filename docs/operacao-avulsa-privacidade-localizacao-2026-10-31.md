# KATUÁ — entradas avulsas, rotas por área e acompanhamento Web

Entrega de 31/10/2026. Escopo: App Web, painel e servidor. Nenhum APK, build iOS ou configuração EAS é necessário nesta entrega.

## Operação entregue

| Necessidade | Acesso e comportamento |
| --- | --- |
| Entrega de autônomo na sede | Painel → Coleta de Resíduo → Entradas e coletas avulsas → Receber material na cooperativa. Não exige cadastro de catador, gerador, equipe ou rota. |
| Sacos misturados ainda sem pesagem | Registra origem/descrição e recebimento físico. Fica aguardando separação e pesagem; não inventa quantidade, produção de catador ou saldo de estoque. |
| Separação e pesagem | Na mesma lista, Separar e pesar seleciona os materiais do catálogo e quantidades reais, preservando unidades. Gera as entradas rastreáveis utilizadas por triagem, estoque, reserva e destinos finais existentes. |
| Busca em endereço não cadastrado | Adicionar coleta em endereço avulso registra nome de pessoa/órgão opcional, endereço, contato/documento opcionais e descrição. Pode receber equipe e veículo ou vincular-se a uma rota ativa. Não cria cadastro permanente de gerador. |
| Chegada à cooperativa | Confirmação explícita de chegada libera pesagem. Se a equipe já registrou materiais em campo, a primeira pesagem avulsa é bloqueada; a conferência utiliza o fluxo existente para não duplicar materiais. |
| Acompanhar motorista | App da cooperativa → Motoristas → Localização; painel → Gestão de Motoristas → Acompanhar coletas. Também há atalho por motorista e no aviso de início da operação. |
| Rotas fixas sem pontos predefinidos | Rotas fixas → Forma de atendimento → Coleta por bairro / área. Descrever bairros/ruas e definir frequência/equipe. A geração cria execuções mesmo com zero pontos; início continua exigindo data, motorista e veículo. |
| Acrescentar pontos em campo | Na execução do App Web, Adicionar ponto durante a rota permite escolher local cadastrado ou nome/endereço avulso com GPS do ponto. Inclusão exige conexão e valida o vínculo da equipe no servidor. |
| CEP e número no cadastro do App | CEP completo consulta a rua automaticamente. Número aciona busca do endereço completo com espera curta para digitação e proteção contra respostas antigas. O usuário continua conferindo e confirmando o marcador; geocodificação não garante posição exata. |
| Offline | Preparo dos arquivos e dados e retomada de sincronização automáticos. A faixa de configuração foi removida. Avisos aparecem somente quando falta conexão ou há registros aguardando confirmação. |

## Termos e privacidade

O App Web apresenta Termos de Uso e Aviso de Privacidade aos perfis de catador, motorista e gerador. O checkbox começa desmarcado e a confirmação é feita pelo próprio titular. A tabela `PrivacyAcceptance` registra usuário, versão, hash/texto do documento, horário informado pelo aparelho e horário de recebimento do servidor. Repetições da mesma versão não multiplicam registros.

A cooperativa consulta a confirmação em **Termos e privacidade** nas listas de catadores, motoristas e geradores. Um cadastro sem conta ou ainda sem confirmação é apresentado como pendente; o administrador não pode marcar um aceite em nome do titular. O aviso deve ser apresentado também no procedimento presencial de coleta de dados, conforme a política definida pela operação.

A ciência do aviso e o aceite dos termos não são tratados como autorização genérica de uso de dados. O texto e os contatos do responsável precisam ser validados pela gestão responsável pela política de privacidade antes de considerar o documento uma política jurídica definitiva. A base legal, conservação e atendimento dos direitos dependem da operação real; esta implementação não declara conformidade jurídica completa por existir um checkbox.

O envio de GPS é uma autorização separada, opcional, vinculada a uma rota/coleta e encerrável pelo motorista. No navegador, o sistema solicita a permissão e explica como liberar o GPS e as permissões do site se o acesso estiver negado ou indisponível. O site não pode ligar o GPS do sistema operacional por conta própria.

## Integridade e autorização

- Migração aditiva `20261101010000_field_intakes_coverage_privacy`: campos de entrada avulsa, modalidade/área de rota e tabela de aceites. Dados existentes são preservados; rotas anteriores recebem modalidade `POINTS`.
- Entrada e pesagem possuem protocolos e hashes de conteúdo. Repetição após perda de resposta devolve o registro existente; conteúdo diferente com o mesmo protocolo é rejeitado.
- Recebimento direto não atribui catador/rota/equipe nem gera crédito fictício. A pesagem inicial só ocorre em material recebido, ainda sem registros normalizados. Material pesado segue `CollectionMaterial → CollectionWasteEntry → destinações/lotes` existentes.
- Vincular coleta a uma rota utiliza equipe e veículo da execução. Recursos de outra cooperativa, inativos ou incompatíveis são recusados. Equipes existentes conservam o snapshot de participantes.
- Inclusão de ponto é serializada sob bloqueio da rota, verifica titularidade/equipe e impede alteração de conteúdo de uma repetição ou inclusão em execução encerrada.
- Rotas por área vazias aparecem nas consultas de rotas fixas, incluindo busca por nome e filtro em campo. Para concluir uma execução com material, registre os atendimentos; uma saída sem coleta deve ser encerrada pelo procedimento de resolução/cancelamento, sem inventar produção.
- Início de rota/coleta gera um aviso durável para a cooperativa na mesma transação, sem duplicação ao repetir a confirmação.
- Localização é obtida pela API existente, com escopo da cooperativa, estado de atualização, horário e precisão. Posição antiga é identificada como antiga. GPS não entra na fila offline nem é reproduzido como localização ao vivo.
- No primeiro carregamento, a solicitação considera o serviço ativo mais recente quando não há envio local. Serviços antigos não geram uma sequência de popups. Novos inícios durante o uso voltam a solicitar autorização.
- Novas funcionalidades de campo que dependem de conexão não anunciam sucesso offline. Coletas e rascunhos já suportados continuam sendo salvos e sincronizados conforme o fluxo anterior.

## Endpoints principais

- `GET /privacy/notice`, `POST /privacy/acceptance`: documento atual e confirmação do usuário autenticado.
- `GET /privacy/subjects/:kind/:id`: consulta de aceite, restrita à cooperativa proprietária (`drivers`, `collectors`, `generators`).
- `GET/POST /material-intakes`: lista paginada e criação da entrada/coleta avulsa.
- `POST /material-intakes/:id/arrive`, `POST /material-intakes/:id/weigh`: recebimento físico e pesagem inicial.
- `GET /routes/:id/point-sources`, `POST /routes/:id/field-points`: fontes autorizadas e inclusão durante a execução.
- `/route-plans`: `coverageMode` (`POINTS` ou `AREA`) e `coverageArea`; validações de atendimento em português.
- `/driver-tracking/*` e `/notifications`: contratos existentes, ampliados com contexto de início e atalhos no painel.

## Atualização da VPS

Servidor, incluindo a migração:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

App Web, preservando a preparação automática de PWA:

```bash
cd /var/www/katua/app && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

Não usar export simples do Expo omitindo o pós-processamento da PWA. A VPS precisa servir o `dist` do App, incluindo `sw.js`, no domínio HTTPS já configurado. A atualização de páginas em uso não força recarregamento nem elimina registros locais.

## Aceitação operacional

Validar com usuários reais: primeiro acesso e checkbox; negar e liberar localização; iniciar serviço e acompanhar nos dois ambientes; registrar entrega sem pesagem e conferir depois; coletar em endereço avulso; executar rota por área e acrescentar ponto; perder conexão e recarregar o App. GPS em segundo plano e com navegador fechado não é garantido e não faz parte desta entrega.
