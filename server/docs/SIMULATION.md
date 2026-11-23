# Simulação isolada de venda e documentos

Primeira entrega de validação do fluxo comercial e ambiental. Não é integração oficial nem ambiente de homologação SEFAZ/SINIR. Nenhuma regra tributária é calculada. Os PDFs são demonstrativos genéricos, sem chave, assinatura, protocolo ou validade oficial.

## Habilitação

1. Aplicar a migração Prisma `20261123020000_isolated_simulation` e publicar API/painel.
2. Entrar com perfil ADMIN, abrir Cooperativas e buscar CoopApolinario.
3. Clicar Habilitar simulação e Abrir simulação.
4. O acesso da própria cooperativa também encontra a opção em Central ambiental e SINIR.

Não há ativação automática pelo nome, troca de perfil, senha embutida ou alteração do cadastro do piloto. Somente ADMIN habilita o ambiente; COOPERATIVE acessa exclusivamente o próprio ambiente habilitado. Outros perfis não têm acesso. Desabilitar via endpoint `/simulation/workspaces/:id/enable` com `{enabled:false}` preserva o histórico.

## Dados e roteiro

São criados materiais, compradores e lotes fictícios no JSON de SimulationWorkspace, separados do catálogo e estoque operacionais. Papelão: três lotes de 200, 170 e 130 kg; PET: 120 kg; óleo: 80 L. A versão inicial já oferece comprador demonstrativo, motorista e veículo de teste.

1. Prévia de 400 kg de papelão a R$ 0,80: total R$ 320; retiradas de 200, 170 e 30 kg; saldo 100 kg.
2. Salvar rascunho: não reserva nem baixa materiais.
3. Gerar NF-e simulada. Opções: confirmação, rejeição ou resposta perdida.
4. Em resposta perdida, consultar o MESMO identificador, sem emitir outro.
5. Gerar MTR simulado, confirmar saída demonstrativa, registrar recebimento e gerar CDF simulado.
6. Registrar pagamento parcial ou total independentemente da etapa física.
7. Cancelar NF-e simulada não devolve material ao saldo. Não simula prazos ou admissibilidade legal de cancelamento.

A ordem NF-e → MTR é uma convenção deste cenário de venda, não uma regra jurídica universal. Recebimento divergente exige observação, preserva quantidade expedida e valor original da venda; o CDF demonstrativo usa a quantidade recebida. Sem ajuste financeiro automático. Não há conversão de litros para kg.

## Isolamento e consistência

Somente SimulationWorkspace e SimulationEvent são escritos. A alocação FIFO reutiliza uma função pura do estoque com lotes sintéticos em memória. Sem atualização de WasteStockLot, movimentação operacional, coleta, documento interno, financeiro real ou indicadores ambientais. Sem transmissão externa.

Operações possuem UUID, hash, ator e versão. Repetir a mesma operação retorna o resultado sem nova baixa/emissão. Corpo diferente ou outro ator com mesmo UUID gera conflito. Lock de linha e checagem de versão protegem contra edição concorrente. Falta de saldo desfaz a transação inteira. A interface mantém o mesmo UUID ao reenviar uma ação com resposta perdida; 409 exige conferir dados atualizados.

Limites por ambiente: 20 vendas, 50 compradores, 12 tentativas documentais por venda, 20 pagamentos por venda e JSON até 2 MiB. Sem exclusão/reset na interface nesta fase. Histórico da tela exibe as últimas 30 ações; eventos anteriores continuam no banco. Não cadastrar informações sensíveis para demonstração.

## Validação reproduzível

Com ferramentas locais de teste contendo PGlite e pglite-socket:

`KATUA_VALIDATION_TOOLS=/caminho/node_modules node tests/simulation/run.mjs`

O runner cria banco descartável, aplica a migração sobre schema anterior e valida preservação de cadastro, permissões, segregação, saldos/decimais/unidades, replay, conflito, rollback, documentos, recebimento e pagamentos. fetch externo é bloqueado e a contagem deve ser zero. Snapshot de tabelas operacionais deve permanecer idêntico.

Para navegador, instalar também Playwright e @sparticuz/chromium nas ferramentas, compilar o painel e adicionar `KATUA_SIMULATION_BROWSER=/caminho/Katua_Web/tests/simulation/browser.mjs` à execução. A API é real e usa exclusivamente o banco descartável. O navegador valida PDF, fluxo e largura móvel.

Próxima fase: validar processo com a cooperativa e definir dados fiscais/ambientais, tributação, atores e integração oficial. Esta entrega não prepara XML oficial nem transmite documentos reais.
