# Comunicação entre App, servidor e Painel - 29/10/2026

## Resultado

- Painel: central de avisos com sino, contagem de não lidos, leitura individual/geral, paginação e acesso direto à rota, O.C. ou solicitação.
- Servidor: avisos transacionais de novas solicitações, atribuição/início de coleta, retirada aguardando recebimento e envio/complementação/decisão de O.C. Reenvios não duplicam avisos. Uma falha ao persistir aviso reverte a operação associada.
- Painel: atualização periódica e ao recuperar foco/conexão no Dashboard, solicitações, calendário, O.C. e módulos de resíduos. Pausa em diálogos e edições; dados anteriores permanecem visíveis se uma atualização falha. Inventário/catálogo/lotes em formulário não são recarregados automaticamente.
- App: atualização opt-in de consultas de catador, geradores comercial/residencial e O.C. do catador, com pausa durante preenchimento. As telas de cadastro residencial continuam sem atualização automática do formulário.
- O.C.: tentativa manual explícita ignora a espera automática após falha, mantendo a identidade original da operação. Tentativas automáticas continuam com intervalo progressivo.
- Rotas de catador/motorista: novo GET /routes/field-workspace com view=active|history, page e limit (máximo 50; App usa 20). Resumos não incluem os pontos; os detalhes são consultados ao abrir a execução. Cache de resumos preserva os pontos já baixados.
- Painel: timeout de 20 segundos; mensagens para conexão, timeout e sessão expirada; 401 da sessão ativa leva ao login. Resposta antiga não remove token de uma sessão nova. Troca de conta em outra aba reinicializa a autenticação.

## Limite do perfil Cooperativa no App

Nenhum arquivo em app/(cooperativa) foi modificado. O bootstrap, layouts e a política global de sincronização do App foram preservados. O novo hook recusa explicitamente COOPERATIVE; o novo endpoint de rotas é opt-in e recusa esse perfil. O serviço legado /routes e a tentativa comum de O.C. continuam disponíveis sem mudança de contrato. O servidor passa a registrar novos eventos de negócio no inbox já existente; isso não redesenha nem altera os comandos das telas da Cooperativa no App.

## Validação

67 verificações de API, 14 de offline/históricos, 7 de O.C., 2 de limite por perfil, 2 de cache de rotas, 8 de interface do Painel e 5 de regressão da execução do catador. Builds e verificações de tipos/lint aprovados. A falha SQL provocada durante o teste de rollback é intencional.

As interfaces foram exercitadas em Chromium com dados demonstrativos. Não houve acesso à VPS. Não representa homologação em Android/iPhone físico nem ensaio de carga. Permanecem os avisos conhecidos de assets/chunks do build e de CSS Leaflet no export.

## Publicação

Atualizar API primeiro, depois Painel e export/build do App. Reiniciar katua-api.service após build da API e reabrir o App após publicar seu export. Não há nova migração de banco nesta entrega. Os binários Android/iOS precisam de atualização própria para incorporar mudanças de interface.

A redução de tráfego desta entrega se concentra no workspace de rotas; os endpoints legados de listas completas continuam compatíveis. Atualização é por consulta periódica, não push em segundo plano. O Painel somente verá operações offline depois da sincronização com o servidor.
