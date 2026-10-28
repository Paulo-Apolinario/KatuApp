# Revisão do App e calendário operacional

Data: 28/10/2026. Escopo solicitado: catador, motorista, PF e geradores; calendário do painel. O perfil cooperativa no App foi excluído dos ajustes de telas. A atualização inclui somente componentes de execução de rotas usados por catador/motorista, preservação de dados no serviço de rotas, mensagem da API e navegação do painel.

## Diagnóstico dos problemas apresentados

1. **Saída da coleta diária:** a execução exibida está sem motorista e veículo. A regra atual da API exige data, motorista, veículo e ao menos um ponto pendente/em andamento. A rejeição protege a operação, porém a mensagem indicava ao catador que deveria configurar esses dados. A configuração continua sendo responsabilidade da cooperativa; não foram atribuídos recursos automaticamente nem removida a validação.
2. **Calendário em branco:** o botão Agenda de hoje no painel apontava para `/calendar`, enquanto a página registrada era `/operational-calendar`. O link foi corrigido e o endereço antigo ganhou redirecionamento compatível.
3. **Datas e acesso aos eventos:** o calendário podia posicionar uma coleta pela criação antes de considerar a programação da rota e não oferecia links para o detalhe. Também ocultava eventos adicionais do dia sem acesso à lista completa.
4. **Atendimento em equipe:** a API entregava os participantes, mas a normalização do serviço de rotas descartava a lista. O integrante que não era o responsável principal podia perder a ação Atender este ponto. Os participantes e o identificador de equipe agora são preservados.

## Backlog entregue

- [x] Mostrar Aguardando preparação pela cooperativa antes da saída, com as pendências da execução, sem pedir ao catador que cadastre motorista ou veículo.
- [x] Desabilitar a confirmação da saída enquanto faltarem recursos/data/ponto disponível e manter a validação no servidor.
- [x] Distinguir motorista inativo e veículo fora de operação na checagem do App. Atualização do cadastro continua no painel.
- [x] Tornar a mensagem da API apropriada ao catador/motorista, mantendo a mensagem de configuração usada pelo painel.
- [x] Priorizar rota em andamento e depois programação atual/próxima ao abrir o roteiro sem seleção explícita; preservar a consulta de execuções anteriores.
- [x] Preservar participantes e equipe na rota recebida, permitindo atendimento pelo integrante autorizado.
- [x] Corrigir o link Abrir calendário e o encaminhamento de Conferir coleta no painel inicial.
- [x] Redirecionar `/calendar` para `/operational-calendar`.
- [x] Abrir o registro diretamente ao clicar em um evento ou em um dia com somente um evento.
- [x] Em dias com vários eventos, mostrar agenda completa, sem esconder definitivamente os registros após o terceiro cartão.
- [x] Encaminhar coleta para `/waste-list?coleta=ID` e solicitação para `/collection-requests?solicitacao=ID`, abrindo o respectivo detalhe.
- [x] Usar data efetiva da coleta quando houver; caso contrário, usar a programação da solicitação/rota e depois a data desejada. Datas civis respeitam America/Fortaleza.
- [x] Não apresentar data de criação como programação. Registros sem data são informados com atalhos para revisão.
- [x] Não duplicar agendamento quando sua coleta já integra os eventos recebidos.
- [x] Buscar também pelos rótulos em português e exibir os indicadores relativos ao mês selecionado.
- [x] Não converter litros ou unidades em kg na listagem de eventos; toneladas são convertidas corretamente.
- [x] Exibir falhas de atualização e preservar dados previamente carregados; oferecer nova tentativa.
- [x] Navegação de mês e dia acessível por teclado, com rótulos; grade com rolagem interna em telas pequenas.

## Percepção geral do App

Foram realizadas análise estática de 173 arquivos de App/código compartilhado fora do grupo cooperativa, conferência de 116 destinos literais de navegação e análise de lint em 159 arquivos, sem erros ou avisos. A revisão considerou autenticação, separação de perfis, navegação, listas operacionais, roteiros, coletas, solicitações/O.C.s, PEVs, mapas, notificações, consultas de produção, comprovantes e sincronização. Essa leitura e os testes direcionados não equivalem a exercitar todos os botões em aparelho físico.

Os contratos já existentes de isolamento dos dados locais por conta, tratamento de sessão 401, preservação em erro de rede, proteção contra resposta antiga de autenticação, armazenamento nativo do token e preservação de unidades no PDF continuam aprovados. A fila offline identifica o proprietário das operações. Os ajustes desta entrega não removem essas proteções.

### Melhorias recomendadas para a próxima etapa — ainda não implementadas

| Prioridade | Tema | Evidência e proposta |
| --- | --- | --- |
| Alta | Falha de consulta versus ausência de dados | Em `app/(pf-tabs)/ranking.tsx`, o erro de carregamento limpa a lista sem aviso na tela. Padronizar aviso, nova tentativa e indicação de dados salvos nas consultas; erro de rede não deve parecer produção inexistente. |
| Alta | Escalabilidade das consultas | O App usa listagens gerais de rotas/coletas e o calendário do painel usa as APIs existentes. Paginar no servidor, consultar por período/status e carregar detalhes sob demanda antes de ampliar o número de cooperativas e anos de histórico. |
| Alta | Modalidade de transporte | A regra atual exige motorista e veículo. Se a cooperativa opera a pé ou com equipamentos sem motorista, definir modalidade explicitamente no planejamento e validar os recursos conforme essa modalidade. Não liberar saídas incompletas implicitamente. |
| Média | Pendências offline | Complementar o resumo e a sincronização já existentes com uma visão por operação: aguardando envio, enviada, falhou e exige revisão. Manter a identificação da conta e impedir que uma conclusão ultrapasse um início ainda não confirmado. |
| Média | Recursos ainda indisponíveis de PF | Chat e loja/benefícios são telas que explicitamente informam indisponibilidade. Avaliar ocultar os atalhos até a implantação ou agrupá-los em recursos futuros, para que o usuário não interprete como falha. |
| Média | Consistência de interface | Padronizar estados de carregamento, erro, vazio, botões ocupados, textos de etapas e áreas de toque nas telas antigas, preservando as funções operacionais já existentes. |
| Validação em campo | GPS, câmera e retomada | Executar roteiro em Android/iPhone real: permissão negada e concedida, baixa precisão em local fechado, perda/retorno de internet, suspensão, retomada e confirmação de envio de fotos e coletas. Não há defeito novo de GPS confirmado por esta revisão. |

## Validação desta entrega

34 verificações aprovadas:

- 11 contratos do App, incluindo os cenários novos de preparação e seleção da execução.
- 6 verificações de API em banco PostgreSQL descartável: bloqueio da saída incompleta, rejeição de catador não atribuído, preparação pela cooperativa, início após liberação, acompanhamento pelo motorista e bloqueio de encerramento com pendência.
- 7 verificações do modelo do calendário: fuso, datas inválidas, programação, coleta efetiva, deduplicação, links e unidades.
- 3 verificações no App web com largura de 390 px: aviso/bloqueio antes da preparação, liberação após atualização e atendimento por integrante, sem erro JavaScript.
- 7 verificações no painel: link inicial, endereço legado, lista diária, coleta correta, solicitação correta, falha de consulta/ausência de programação/layout móvel e navegação sem erro JavaScript.

TypeScript do App e da API, build da API, exportação Expo web, ESLint e build do painel aprovados. O aviso preexistente de bundle do painel maior que 500 kB permanece. Testes locais com dados e transporte controlados, sem acessar a VPS. Limites: sem teste físico de GPS/câmera, sem teste de carga de grandes bases e sem validação funcional de todas as combinações de telas.

Detalhes em `docs/validacao-app-calendario-2026-10-28.json`; reprodução em `server/tests/app-route-calendar/README.md` no KatuApp.

## Aplicação

Publicar KatuApp/main e Katua_Web/main. Na VPS, atualizar/compilar/reiniciar a API por `katua-api.service`, exportar novamente o App web e compilar o painel. Não há migração de banco nova nesta entrega. Recarregar os navegadores após a atualização. A execução diária já criada precisa receber motorista e veículo no painel da cooperativa; atualizar o App permite confirmar a saída após essa preparação.
