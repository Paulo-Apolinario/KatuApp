# Auditoria funcional do painel KATUÁ

Data: **04/11/2026**. Desenvolvimento da plataforma: **Paulo Roberto Apolinario da Silva** e **Nilton Felipe de Oliveira Braz**.

Foram aprovadas **509 verificações da matriz principal** e **12 verificações adicionais de regressão**, totalizando **521**, no escopo descrito abaixo. Não foram encontrados erros JavaScript nos percursos concluídos. Os resultados representam os casos executados, não uma garantia de ausência de qualquer defeito possível.

## Como a cobertura foi organizada

A matriz distingue validação de interface no navegador e regras de negócio verificadas nas APIs reais que o painel utiliza. Os cinco casos por tela são abertura com informações/controles, links internos, recarregamento direto, apresentação em celular e falha de leitura/validação inicial. Os cinco casos por cadastro incluem persistência, rejeição, repetição/vínculos, edição e isolamento/versão. Há ainda formulários reais, exportações e operações completas pelo navegador.

| Grupo | Verificações aprovadas |
|---|---:|
| Interface: 56 telas × 5 casos | 280 |
| Cadastros: 19 famílias × 5 situações | 95 |
| Adversas: 4 grupos × 5 situações | 20 |
| Operacionais: 6 grupos × 10 situações | 60 |
| Formulários, recebimento e os seis destinos no navegador | 17 |
| PDFs de cadastros, individual e todos | 6 |
| Busca sem resultado em cinco gestões | 1 |
| Cinco relatórios × cinco verificações funcionais | 25 |
| Sessão, perfil, expiração e recuperação | 5 |
| Regressões de conclusão e documentos internos | 12 |
| **Total** | **521** |

## Correções decorrentes da revisão

1. **Editar motorista:** antes a tela alterava somente o status. Agora permite corrigir nome, telefone, CPF, CNH, categoria e observações. O e-mail de acesso permanece identificado como somente leitura. O servidor valida a cooperativa, impede CPF duplicado dentro dela e atualiza o nome da conta vinculada na mesma transação.
2. **Cadastros com espaços:** nome de motorista e placa/modelo de veículo são normalizados antes da validação. Campos preenchidos só com espaços não produzem cadastro aparentemente válido.
3. **Paginação:** anterior/próximo possuem bloqueio real nos limites, inclusive com zero registros. Filtro que reduz resultados ajusta a página e mudar a quantidade por página volta para o início.
4. **Falha de leitura:** avisos de consulta permanecem até a recuperação ou a navegação. Uma lista não aparenta simplesmente estar vazia depois que um aviso temporário desaparece. Respostas antigas e de outra sessão não atualizam esse aviso.
5. **Manutenções e documentos de veículo:** usam o cliente de API comum, com autenticação, timeout, expiração e mensagens em português. O envio de FormData e anexos foi preservado.
6. **Datas e custo:** manutenção rejeita próxima data anterior à atual; documentos rejeitam vencimento anterior à emissão. Datas inválidas não viram datas silenciosamente ausentes. Custo zero é preservado como zero.
7. **Sessão:** indisponibilidade do banco na conferência do token retorna 503, em vez de tratá-lo como inválido. O painel preserva o acesso salvo, mostra uma tela de recuperação e permite tentar de novo. Token realmente inválido continua encerrando a sessão.
8. **Equipes:** cadastros de catadores sem conta no App podem compor equipe, assim como já podiam receber delegação individual. Catador inativo e conta vinculada desativada continuam bloqueados. Isso não cria conta nem libera autenticação no App.
9. **Estrutura das telas:** removidos elementos principais de página aninhados; o painel conserva uma única região principal para navegação assistiva.

## Método e limites

- Build real do painel, Chromium em 1440 × 1000 e 390 × 844, Fastify/Prisma reais e PostgreSQL descartável via PGlite. Nenhum dado de produção foi alterado.
- Cadastros e movimentações verificados por respostas e leituras posteriores do servidor; não se considerou apenas a mensagem de sucesso da tela. PDFs/planilhas foram baixados e seus formatos conferidos.
- Dados e mapas de cadastro controlados. Não houve validação em aparelho físico, emissão oficial de MTR/SINIR, teste de carga em PostgreSQL nativo ou envio real de e-mails. A central ambiental foi verificada como tela do painel.
- O escopo é o painel da cooperativa e as telas de cadastro acessíveis a partir dele; não inclui os módulos antigos de frequência/zonas sem entrada no menu nem o portal municipal de outro perfil.
- Rotas fixas mantêm a janela existente de geração de sete dias. O caso de recorrência testa execuções independentes dentro dessa janela, inclusive a preservação de pontos do próximo dia após encerramento parcial.
- O build ainda informa um pacote JavaScript inicial grande. Dividir o carregamento das telas e bibliotecas de relatórios é uma melhoria de desempenho para um próximo ciclo; a auditoria atual verifica funcionamento e apresentação, não desempenho em rede móvel real.

## Atualização na VPS

Não há nova migração de banco nesta entrega. A publicação do código não faz implantação automática na VPS.

Servidor:

```bash
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

Painel:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

## Matriz completa executada

Os identificadores abaixo são únicos; retestes substituem o resultado anterior e não aumentam a contagem. `PASS` significa aprovado no cenário descrito.

### Interface: 56 telas × 5 casos

| ID | Situação executada | Resultado |
|---|---|---|
| TAB01-1 | Painel Geral — abrir dados e controles no desktop | Aprovado |
| TAB01-2 | Painel Geral — links e ações internas têm telas registradas | Aprovado |
| TAB01-3 | Painel Geral — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB01-4 | Painel Geral — celular sem transbordamento e menu utilizável | Aprovado |
| TAB01-5 | Painel Geral — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB02-1 | Central de avisos — abrir dados e controles no desktop | Aprovado |
| TAB02-2 | Central de avisos — links e ações internas têm telas registradas | Aprovado |
| TAB02-3 | Central de avisos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB02-4 | Central de avisos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB02-5 | Central de avisos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB03-1 | Entregadores avulsos — abrir dados e controles no desktop | Aprovado |
| TAB03-2 | Entregadores avulsos — links e ações internas têm telas registradas | Aprovado |
| TAB03-3 | Entregadores avulsos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB03-4 | Entregadores avulsos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB03-5 | Entregadores avulsos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB04-1 | Entradas e coletas avulsas — abrir dados e controles no desktop | Aprovado |
| TAB04-2 | Entradas e coletas avulsas — links e ações internas têm telas registradas | Aprovado |
| TAB04-3 | Entradas e coletas avulsas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB04-4 | Entradas e coletas avulsas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB04-5 | Entradas e coletas avulsas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB05-1 | Ordens de Serviço — abrir dados e controles no desktop | Aprovado |
| TAB05-2 | Ordens de Serviço — links e ações internas têm telas registradas | Aprovado |
| TAB05-3 | Ordens de Serviço — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB05-4 | Ordens de Serviço — celular sem transbordamento e menu utilizável | Aprovado |
| TAB05-5 | Ordens de Serviço — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB06-1 | Lista de Coletas — abrir dados e controles no desktop | Aprovado |
| TAB06-2 | Lista de Coletas — links e ações internas têm telas registradas | Aprovado |
| TAB06-3 | Lista de Coletas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB06-4 | Lista de Coletas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB06-5 | Lista de Coletas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB07-1 | Coletas Solicitadas — abrir dados e controles no desktop | Aprovado |
| TAB07-2 | Coletas Solicitadas — links e ações internas têm telas registradas | Aprovado |
| TAB07-3 | Coletas Solicitadas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB07-4 | Coletas Solicitadas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB07-5 | Coletas Solicitadas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB08-1 | Ordens de coleta extras — abrir dados e controles no desktop | Aprovado |
| TAB08-2 | Ordens de coleta extras — links e ações internas têm telas registradas | Aprovado |
| TAB08-3 | Ordens de coleta extras — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB08-4 | Ordens de coleta extras — celular sem transbordamento e menu utilizável | Aprovado |
| TAB08-5 | Ordens de coleta extras — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB09-1 | Lista de PEVs — abrir dados e controles no desktop | Aprovado |
| TAB09-2 | Lista de PEVs — links e ações internas têm telas registradas | Aprovado |
| TAB09-3 | Lista de PEVs — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB09-4 | Lista de PEVs — celular sem transbordamento e menu utilizável | Aprovado |
| TAB09-5 | Lista de PEVs — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB10-1 | Cadastrar PEV — abrir dados e controles no desktop | Aprovado |
| TAB10-2 | Cadastrar PEV — links e ações internas têm telas registradas | Aprovado |
| TAB10-3 | Cadastrar PEV — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB10-4 | Cadastrar PEV — celular sem transbordamento e menu utilizável | Aprovado |
| TAB10-5 | Cadastrar PEV — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB11-1 | Listar Geradores — abrir dados e controles no desktop | Aprovado |
| TAB11-2 | Listar Geradores — links e ações internas têm telas registradas | Aprovado |
| TAB11-3 | Listar Geradores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB11-4 | Listar Geradores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB11-5 | Listar Geradores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB12-1 | Cadastrar Gerador — abrir dados e controles no desktop | Aprovado |
| TAB12-2 | Cadastrar Gerador — links e ações internas têm telas registradas | Aprovado |
| TAB12-3 | Cadastrar Gerador — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB12-4 | Cadastrar Gerador — celular sem transbordamento e menu utilizável | Aprovado |
| TAB12-5 | Cadastrar Gerador — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB13-1 | Documentos dos geradores — abrir dados e controles no desktop | Aprovado |
| TAB13-2 | Documentos dos geradores — links e ações internas têm telas registradas | Aprovado |
| TAB13-3 | Documentos dos geradores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB13-4 | Documentos dos geradores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB13-5 | Documentos dos geradores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB14-1 | Histórico dos geradores — abrir dados e controles no desktop | Aprovado |
| TAB14-2 | Histórico dos geradores — links e ações internas têm telas registradas | Aprovado |
| TAB14-3 | Histórico dos geradores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB14-4 | Histórico dos geradores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB14-5 | Histórico dos geradores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB15-1 | Veículos — abrir dados e controles no desktop | Aprovado |
| TAB15-2 | Veículos — links e ações internas têm telas registradas | Aprovado |
| TAB15-3 | Veículos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB15-4 | Veículos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB15-5 | Veículos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB16-1 | Cadastrar Veículo — abrir dados e controles no desktop | Aprovado |
| TAB16-2 | Cadastrar Veículo — links e ações internas têm telas registradas | Aprovado |
| TAB16-3 | Cadastrar Veículo — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB16-4 | Cadastrar Veículo — celular sem transbordamento e menu utilizável | Aprovado |
| TAB16-5 | Cadastrar Veículo — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB17-1 | Documentos dos veículos — abrir dados e controles no desktop | Aprovado |
| TAB17-2 | Documentos dos veículos — links e ações internas têm telas registradas | Aprovado |
| TAB17-3 | Documentos dos veículos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB17-4 | Documentos dos veículos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB17-5 | Documentos dos veículos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB18-1 | Histórico dos veículos — abrir dados e controles no desktop | Aprovado |
| TAB18-2 | Histórico dos veículos — links e ações internas têm telas registradas | Aprovado |
| TAB18-3 | Histórico dos veículos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB18-4 | Histórico dos veículos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB18-5 | Histórico dos veículos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB19-1 | Manutenções — abrir dados e controles no desktop | Aprovado |
| TAB19-2 | Manutenções — links e ações internas têm telas registradas | Aprovado |
| TAB19-3 | Manutenções — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB19-4 | Manutenções — celular sem transbordamento e menu utilizável | Aprovado |
| TAB19-5 | Manutenções — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB20-1 | Rotas cadastradas — abrir dados e controles no desktop | Aprovado |
| TAB20-2 | Rotas cadastradas — links e ações internas têm telas registradas | Aprovado |
| TAB20-3 | Rotas cadastradas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB20-4 | Rotas cadastradas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB20-5 | Rotas cadastradas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB21-1 | Rotas fixas — abrir dados e controles no desktop | Aprovado |
| TAB21-2 | Rotas fixas — links e ações internas têm telas registradas | Aprovado |
| TAB21-3 | Rotas fixas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB21-4 | Rotas fixas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB21-5 | Rotas fixas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB22-1 | Central ambiental — abrir dados e controles no desktop | Aprovado |
| TAB22-2 | Central ambiental — links e ações internas têm telas registradas | Aprovado |
| TAB22-3 | Central ambiental — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB22-4 | Central ambiental — celular sem transbordamento e menu utilizável | Aprovado |
| TAB22-5 | Central ambiental — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB23-1 | Calendário Operacional — abrir dados e controles no desktop | Aprovado |
| TAB23-2 | Calendário Operacional — links e ações internas têm telas registradas | Aprovado |
| TAB23-3 | Calendário Operacional — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB23-4 | Calendário Operacional — celular sem transbordamento e menu utilizável | Aprovado |
| TAB23-5 | Calendário Operacional — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB24-1 | Criar Rota — abrir dados e controles no desktop | Aprovado |
| TAB24-2 | Criar Rota — links e ações internas têm telas registradas | Aprovado |
| TAB24-3 | Criar Rota — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB24-4 | Criar Rota — celular sem transbordamento e menu utilizável | Aprovado |
| TAB24-5 | Criar Rota — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB25-1 | Motoristas — abrir dados e controles no desktop | Aprovado |
| TAB25-2 | Motoristas — links e ações internas têm telas registradas | Aprovado |
| TAB25-3 | Motoristas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB25-4 | Motoristas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB25-5 | Motoristas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB26-1 | Acompanhar coletas — abrir dados e controles no desktop | Aprovado |
| TAB26-2 | Acompanhar coletas — links e ações internas têm telas registradas | Aprovado |
| TAB26-3 | Acompanhar coletas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB26-4 | Acompanhar coletas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB26-5 | Acompanhar coletas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB27-1 | Adicionar motorista — abrir dados e controles no desktop | Aprovado |
| TAB27-2 | Adicionar motorista — links e ações internas têm telas registradas | Aprovado |
| TAB27-3 | Adicionar motorista — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB27-4 | Adicionar motorista — celular sem transbordamento e menu utilizável | Aprovado |
| TAB27-5 | Adicionar motorista — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB28-1 | Documentos dos motoristas — abrir dados e controles no desktop | Aprovado |
| TAB28-2 | Documentos dos motoristas — links e ações internas têm telas registradas | Aprovado |
| TAB28-3 | Documentos dos motoristas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB28-4 | Documentos dos motoristas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB28-5 | Documentos dos motoristas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB29-1 | Histórico dos motoristas — abrir dados e controles no desktop | Aprovado |
| TAB29-2 | Histórico dos motoristas — links e ações internas têm telas registradas | Aprovado |
| TAB29-3 | Histórico dos motoristas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB29-4 | Histórico dos motoristas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB29-5 | Histórico dos motoristas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB30-1 | Catadores — abrir dados e controles no desktop | Aprovado |
| TAB30-2 | Catadores — links e ações internas têm telas registradas | Aprovado |
| TAB30-3 | Catadores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB30-4 | Catadores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB30-5 | Catadores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB31-1 | Adicionar catador — abrir dados e controles no desktop | Aprovado |
| TAB31-2 | Adicionar catador — links e ações internas têm telas registradas | Aprovado |
| TAB31-3 | Adicionar catador — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB31-4 | Adicionar catador — celular sem transbordamento e menu utilizável | Aprovado |
| TAB31-5 | Adicionar catador — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB32-1 | Equipes de catadores — abrir dados e controles no desktop | Aprovado |
| TAB32-2 | Equipes de catadores — links e ações internas têm telas registradas | Aprovado |
| TAB32-3 | Equipes de catadores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB32-4 | Equipes de catadores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB32-5 | Equipes de catadores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB33-1 | Documentos dos catadores — abrir dados e controles no desktop | Aprovado |
| TAB33-2 | Documentos dos catadores — links e ações internas têm telas registradas | Aprovado |
| TAB33-3 | Documentos dos catadores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB33-4 | Documentos dos catadores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB33-5 | Documentos dos catadores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB34-1 | Histórico dos catadores — abrir dados e controles no desktop | Aprovado |
| TAB34-2 | Histórico dos catadores — links e ações internas têm telas registradas | Aprovado |
| TAB34-3 | Histórico dos catadores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB34-4 | Histórico dos catadores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB34-5 | Histórico dos catadores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB35-1 | Resíduos Coletados — abrir dados e controles no desktop | Aprovado |
| TAB35-2 | Resíduos Coletados — links e ações internas têm telas registradas | Aprovado |
| TAB35-3 | Resíduos Coletados — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB35-4 | Resíduos Coletados — celular sem transbordamento e menu utilizável | Aprovado |
| TAB35-5 | Resíduos Coletados — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB36-1 | Movimentações e Destinações — abrir dados e controles no desktop | Aprovado |
| TAB36-2 | Movimentações e Destinações — links e ações internas têm telas registradas | Aprovado |
| TAB36-3 | Movimentações e Destinações — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB36-4 | Movimentações e Destinações — celular sem transbordamento e menu utilizável | Aprovado |
| TAB36-5 | Movimentações e Destinações — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB37-1 | Estoque e Lotes — abrir dados e controles no desktop | Aprovado |
| TAB37-2 | Estoque e Lotes — links e ações internas têm telas registradas | Aprovado |
| TAB37-3 | Estoque e Lotes — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB37-4 | Estoque e Lotes — celular sem transbordamento e menu utilizável | Aprovado |
| TAB37-5 | Estoque e Lotes — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB38-1 | Catálogo de Resíduos — abrir dados e controles no desktop | Aprovado |
| TAB38-2 | Catálogo de Resíduos — links e ações internas têm telas registradas | Aprovado |
| TAB38-3 | Catálogo de Resíduos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB38-4 | Catálogo de Resíduos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB38-5 | Catálogo de Resíduos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB39-1 | Painel de Indicadores — abrir dados e controles no desktop | Aprovado |
| TAB39-2 | Painel de Indicadores — links e ações internas têm telas registradas | Aprovado |
| TAB39-3 | Painel de Indicadores — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB39-4 | Painel de Indicadores — celular sem transbordamento e menu utilizável | Aprovado |
| TAB39-5 | Painel de Indicadores — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB40-1 | Relatórios de Coletas — abrir dados e controles no desktop | Aprovado |
| TAB40-2 | Relatórios de Coletas — links e ações internas têm telas registradas | Aprovado |
| TAB40-3 | Relatórios de Coletas — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB40-4 | Relatórios de Coletas — celular sem transbordamento e menu utilizável | Aprovado |
| TAB40-5 | Relatórios de Coletas — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB41-1 | Relatórios de Resíduos — abrir dados e controles no desktop | Aprovado |
| TAB41-2 | Relatórios de Resíduos — links e ações internas têm telas registradas | Aprovado |
| TAB41-3 | Relatórios de Resíduos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB41-4 | Relatórios de Resíduos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB41-5 | Relatórios de Resíduos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB42-1 | Impacto ambiental — abrir dados e controles no desktop | Aprovado |
| TAB42-2 | Impacto ambiental — links e ações internas têm telas registradas | Aprovado |
| TAB42-3 | Impacto ambiental — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB42-4 | Impacto ambiental — celular sem transbordamento e menu utilizável | Aprovado |
| TAB42-5 | Impacto ambiental — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB43-1 | Relatórios de Equipe — abrir dados e controles no desktop | Aprovado |
| TAB43-2 | Relatórios de Equipe — links e ações internas têm telas registradas | Aprovado |
| TAB43-3 | Relatórios de Equipe — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB43-4 | Relatórios de Equipe — celular sem transbordamento e menu utilizável | Aprovado |
| TAB43-5 | Relatórios de Equipe — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB44-1 | Relatórios de Veículos — abrir dados e controles no desktop | Aprovado |
| TAB44-2 | Relatórios de Veículos — links e ações internas têm telas registradas | Aprovado |
| TAB44-3 | Relatórios de Veículos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB44-4 | Relatórios de Veículos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB44-5 | Relatórios de Veículos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB45-1 | Dados da cooperativa — abrir dados e controles no desktop | Aprovado |
| TAB45-2 | Dados da cooperativa — links e ações internas têm telas registradas | Aprovado |
| TAB45-3 | Dados da cooperativa — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB45-4 | Dados da cooperativa — celular sem transbordamento e menu utilizável | Aprovado |
| TAB45-5 | Dados da cooperativa — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB46-1 | Minha conta e segurança — abrir dados e controles no desktop | Aprovado |
| TAB46-2 | Minha conta e segurança — links e ações internas têm telas registradas | Aprovado |
| TAB46-3 | Minha conta e segurança — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB46-4 | Minha conta e segurança — celular sem transbordamento e menu utilizável | Aprovado |
| TAB46-5 | Minha conta e segurança — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB47-1 | Preferências operacionais — abrir dados e controles no desktop | Aprovado |
| TAB47-2 | Preferências operacionais — links e ações internas têm telas registradas | Aprovado |
| TAB47-3 | Preferências operacionais — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB47-4 | Preferências operacionais — celular sem transbordamento e menu utilizável | Aprovado |
| TAB47-5 | Preferências operacionais — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB48-1 | Histórico de alterações — abrir dados e controles no desktop | Aprovado |
| TAB48-2 | Histórico de alterações — links e ações internas têm telas registradas | Aprovado |
| TAB48-3 | Histórico de alterações — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB48-4 | Histórico de alterações — celular sem transbordamento e menu utilizável | Aprovado |
| TAB48-5 | Histórico de alterações — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB49-1 | Configuração SMTP — abrir dados e controles no desktop | Aprovado |
| TAB49-2 | Configuração SMTP — links e ações internas têm telas registradas | Aprovado |
| TAB49-3 | Configuração SMTP — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB49-4 | Configuração SMTP — celular sem transbordamento e menu utilizável | Aprovado |
| TAB49-5 | Configuração SMTP — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB50-1 | Central de Pendências — abrir dados e controles no desktop | Aprovado |
| TAB50-2 | Central de Pendências — links e ações internas têm telas registradas | Aprovado |
| TAB50-3 | Central de Pendências — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB50-4 | Central de Pendências — celular sem transbordamento e menu utilizável | Aprovado |
| TAB50-5 | Central de Pendências — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB51-1 | Cadastrar material — abrir dados e controles no desktop | Aprovado |
| TAB51-2 | Cadastrar material — links e ações internas têm telas registradas | Aprovado |
| TAB51-3 | Cadastrar material — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB51-4 | Cadastrar material — celular sem transbordamento e menu utilizável | Aprovado |
| TAB51-5 | Cadastrar material — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB52-1 | Adicionar lote — abrir dados e controles no desktop | Aprovado |
| TAB52-2 | Adicionar lote — links e ações internas têm telas registradas | Aprovado |
| TAB52-3 | Adicionar lote — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB52-4 | Adicionar lote — celular sem transbordamento e menu utilizável | Aprovado |
| TAB52-5 | Adicionar lote — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB53-1 | Cadastrar manutenção — abrir dados e controles no desktop | Aprovado |
| TAB53-2 | Cadastrar manutenção — links e ações internas têm telas registradas | Aprovado |
| TAB53-3 | Cadastrar manutenção — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB53-4 | Cadastrar manutenção — celular sem transbordamento e menu utilizável | Aprovado |
| TAB53-5 | Cadastrar manutenção — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB54-1 | Cadastrar documento do veículo — abrir dados e controles no desktop | Aprovado |
| TAB54-2 | Cadastrar documento do veículo — links e ações internas têm telas registradas | Aprovado |
| TAB54-3 | Cadastrar documento do veículo — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB54-4 | Cadastrar documento do veículo — celular sem transbordamento e menu utilizável | Aprovado |
| TAB54-5 | Cadastrar documento do veículo — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB55-1 | Registros documentais dos veículos — abrir dados e controles no desktop | Aprovado |
| TAB55-2 | Registros documentais dos veículos — links e ações internas têm telas registradas | Aprovado |
| TAB55-3 | Registros documentais dos veículos — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB55-4 | Registros documentais dos veículos — celular sem transbordamento e menu utilizável | Aprovado |
| TAB55-5 | Registros documentais dos veículos — falha de consulta permanece identificada e recuperação funciona | Aprovado |
| TAB56-1 | Perfil da conta — abrir dados e controles no desktop | Aprovado |
| TAB56-2 | Perfil da conta — links e ações internas têm telas registradas | Aprovado |
| TAB56-3 | Perfil da conta — recarregar endereço direto mantém tela utilizável | Aprovado |
| TAB56-4 | Perfil da conta — celular sem transbordamento e menu utilizável | Aprovado |
| TAB56-5 | Perfil da conta — falha de consulta permanece identificada e recuperação funciona | Aprovado |

### Cadastros: 19 famílias × 5 situações

| ID | Situação executada | Resultado |
|---|---|---|
| CAD-gerador-1 | Gerador residencial cadastrado por CPF — criar e consultar persistência (API do painel) | Aprovado |
| CAD-gerador-2 | Gerador residencial cadastrado por CPF — dados inválidos não criam registro | Aprovado |
| CAD-gerador-3 | Gerador residencial cadastrado por CPF — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-gerador-4 | Gerador residencial cadastrado por CPF — corrigir dados e preservar campos existentes | Aprovado |
| CAD-gerador-5 | Gerador residencial cadastrado por CPF — impedir consulta por outra cooperativa | Aprovado |
| CAD-catador-1 | Catador — criar e consultar persistência (API do painel) | Aprovado |
| CAD-catador-2 | Catador — dados inválidos não criam registro | Aprovado |
| CAD-catador-3 | Catador — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-catador-4 | Catador — corrigir dados e preservar campos existentes | Aprovado |
| CAD-catador-5 | Catador — impedir consulta por outra cooperativa | Aprovado |
| CAD-motorista-1 | Motorista — criar e consultar persistência (API do painel) | Aprovado |
| CAD-motorista-2 | Motorista — dados inválidos não criam registro | Aprovado |
| CAD-motorista-3 | Motorista — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-motorista-4 | Motorista — corrigir dados e preservar campos existentes | Aprovado |
| CAD-motorista-5 | Motorista — impedir consulta por outra cooperativa | Aprovado |
| CAD-veiculo-1 | Veículo — criar e consultar persistência (API do painel) | Aprovado |
| CAD-veiculo-2 | Veículo — dados inválidos não criam registro | Aprovado |
| CAD-veiculo-3 | Veículo — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-veiculo-4 | Veículo — corrigir dados e preservar campos existentes | Aprovado |
| CAD-veiculo-5 | Veículo — impedir consulta por outra cooperativa | Aprovado |
| CAD-pev-1 | PEV — criar e consultar persistência (API do painel) | Aprovado |
| CAD-pev-2 | PEV — dados inválidos não criam registro | Aprovado |
| CAD-pev-3 | PEV — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-pev-4 | PEV — corrigir dados e preservar campos existentes | Aprovado |
| CAD-pev-5 | PEV — impedir consulta por outra cooperativa | Aprovado |
| CAD-rota-1 | Rota programada — criar e consultar persistência (API do painel) | Aprovado |
| CAD-rota-2 | Rota programada — dados inválidos não criam registro | Aprovado |
| CAD-rota-3 | Rota programada — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-rota-4 | Rota programada — corrigir dados e preservar campos existentes | Aprovado |
| CAD-rota-5 | Rota programada — impedir consulta por outra cooperativa | Aprovado |
| CAD-catalogo-1 | Material do catálogo — criar e consultar persistência (API do painel) | Aprovado |
| CAD-catalogo-2 | Material do catálogo — dados inválidos não criam registro | Aprovado |
| CAD-catalogo-3 | Material do catálogo — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-catalogo-4 | Material do catálogo — corrigir dados e preservar campos existentes | Aprovado |
| CAD-catalogo-5 | Material do catálogo — impedir consulta por outra cooperativa | Aprovado |
| CAD-gerador-cnpj-1 | Pequeno gerador por CNPJ — criar e consultar persistência (API do painel) | Aprovado |
| CAD-gerador-cnpj-2 | Pequeno gerador por CNPJ — dados inválidos não criam registro | Aprovado |
| CAD-gerador-cnpj-3 | Pequeno gerador por CNPJ — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-gerador-cnpj-4 | Pequeno gerador por CNPJ — corrigir dados e preservar campos existentes | Aprovado |
| CAD-gerador-cnpj-5 | Pequeno gerador por CNPJ — impedir consulta por outra cooperativa | Aprovado |
| CAD-grande-gerador-1 | Grande gerador por CNPJ — criar e consultar persistência (API do painel) | Aprovado |
| CAD-grande-gerador-2 | Grande gerador por CNPJ — dados inválidos não criam registro | Aprovado |
| CAD-grande-gerador-3 | Grande gerador por CNPJ — duplicidade ou vínculo repetido é tratado | Aprovado |
| CAD-grande-gerador-4 | Grande gerador por CNPJ — corrigir dados e preservar campos existentes | Aprovado |
| CAD-grande-gerador-5 | Grande gerador por CNPJ — impedir consulta por outra cooperativa | Aprovado |
| CAD-plano-1 | Rota fixa diária — criar cadastro completo | Aprovado |
| CAD-plano-2 | Rota fixa diária — rejeitar mínimo obrigatório ausente | Aprovado |
| CAD-plano-3 | Rota fixa diária — repetição segura ou participantes/pontos duplicados | Aprovado |
| CAD-plano-4 | Rota fixa diária — editar usando versão atual | Aprovado |
| CAD-plano-5 | Rota fixa diária — rejeitar versão antiga sem sobrescrever | Aprovado |
| CAD-equipe-1 | Equipe de catadores — criar cadastro completo | Aprovado |
| CAD-equipe-2 | Equipe de catadores — rejeitar mínimo obrigatório ausente | Aprovado |
| CAD-equipe-3 | Equipe de catadores — repetição segura ou participantes/pontos duplicados | Aprovado |
| CAD-equipe-4 | Equipe de catadores — editar usando versão atual | Aprovado |
| CAD-equipe-5 | Equipe de catadores — rejeitar versão antiga sem sobrescrever | Aprovado |
| CAD-entregador-1 | Entregador avulso — criar cadastro completo | Aprovado |
| CAD-entregador-2 | Entregador avulso — rejeitar mínimo obrigatório ausente | Aprovado |
| CAD-entregador-3 | Entregador avulso — repetição segura ou participantes/pontos duplicados | Aprovado |
| CAD-entregador-4 | Entregador avulso — editar usando versão atual | Aprovado |
| CAD-entregador-5 | Entregador avulso — rejeitar versão antiga sem sobrescrever | Aprovado |
| CAD-lote-1 | Lote — entrada manual gera código e saldo | Aprovado |
| CAD-lote-2 | Lote — quantidade negativa é rejeitada | Aprovado |
| CAD-lote-3 | Lote — unidade incompatível com catálogo é rejeitada | Aprovado |
| CAD-lote-4 | Lote — editar localização sem alterar origem/quantidade | Aprovado |
| CAD-lote-5 | Lote — outra cooperativa não acessa entrada | Aprovado |
| CAD-manutencao-1 | Manutenção — criar data, custo e observação | Aprovado |
| CAD-manutencao-2 | Manutenção — custo negativo é bloqueado | Aprovado |
| CAD-manutencao-3 | Manutenção — próxima data anterior à manutenção é bloqueada | Aprovado |
| CAD-manutencao-4 | Manutenção — editar observação preserva data e veículo | Aprovado |
| CAD-manutencao-5 | Manutenção — outra cooperativa não acessa registro | Aprovado |
| CAD-documento-veiculo-1 | Registro documental do veículo — criar identificação, emissão e validade | Aprovado |
| CAD-documento-veiculo-2 | Registro documental do veículo — número obrigatório | Aprovado |
| CAD-documento-veiculo-3 | Registro documental do veículo — validade anterior à emissão é rejeitada | Aprovado |
| CAD-documento-veiculo-4 | Registro documental do veículo — edição preserva titular e número | Aprovado |
| CAD-documento-veiculo-5 | Registro documental do veículo — outra cooperativa não acessa registro | Aprovado |
| CAD-doc-collector-1 | Documento collector — enviar PDF para o titular correto | Aprovado |
| CAD-doc-collector-2 | Documento collector — título obrigatório é validado | Aprovado |
| CAD-doc-collector-3 | Documento collector — vencimento anterior à emissão é rejeitado | Aprovado |
| CAD-doc-collector-4 | Documento collector — arquivo retorna PDF autenticado | Aprovado |
| CAD-doc-collector-5 | Documento collector — outra cooperativa não consulta metadados | Aprovado |
| CAD-doc-driver-1 | Documento driver — enviar PDF para o titular correto | Aprovado |
| CAD-doc-driver-2 | Documento driver — título obrigatório é validado | Aprovado |
| CAD-doc-driver-3 | Documento driver — vencimento anterior à emissão é rejeitado | Aprovado |
| CAD-doc-driver-4 | Documento driver — arquivo retorna PDF autenticado | Aprovado |
| CAD-doc-driver-5 | Documento driver — outra cooperativa não consulta metadados | Aprovado |
| CAD-doc-generator-1 | Documento generator — enviar PDF para o titular correto | Aprovado |
| CAD-doc-generator-2 | Documento generator — título obrigatório é validado | Aprovado |
| CAD-doc-generator-3 | Documento generator — vencimento anterior à emissão é rejeitado | Aprovado |
| CAD-doc-generator-4 | Documento generator — arquivo retorna PDF autenticado | Aprovado |
| CAD-doc-generator-5 | Documento generator — outra cooperativa não consulta metadados | Aprovado |
| CAD-doc-vehicle-1 | Documento vehicle — enviar PDF para o titular correto | Aprovado |
| CAD-doc-vehicle-2 | Documento vehicle — título obrigatório é validado | Aprovado |
| CAD-doc-vehicle-3 | Documento vehicle — vencimento anterior à emissão é rejeitado | Aprovado |
| CAD-doc-vehicle-4 | Documento vehicle — arquivo retorna PDF autenticado | Aprovado |
| CAD-doc-vehicle-5 | Documento vehicle — outra cooperativa não consulta metadados | Aprovado |

### Adversas: 4 grupos × 5 situações

| ID | Situação executada | Resultado |
|---|---|---|
| ADV-recebimento-1 | Recebimento — Pesagem sem materiais | Aprovado |
| ADV-recebimento-2 | Recebimento — Quantidade negativa | Aprovado |
| ADV-recebimento-3 | Recebimento — Entrada direta com rota indevida | Aprovado |
| ADV-recebimento-4 | Recebimento — Coleta avulsa sem endereço | Aprovado |
| ADV-recebimento-5 | Recebimento — Coordenada incompleta | Aprovado |
| ADV-destino-1 | Destinação — Saldo excedido | Aprovado |
| ADV-destino-2 | Destinação — Quantidade zero | Aprovado |
| ADV-destino-3 | Destinação — Unidade incompatível | Aprovado |
| ADV-destino-4 | Destinação — Destinatário ausente | Aprovado |
| ADV-destino-5 | Destinação — Protocolo ausente | Aprovado |
| ADV-cadastro-1 | Cadastro — CPF inválido | Aprovado |
| ADV-cadastro-2 | Cadastro — CNPJ inválido | Aprovado |
| ADV-cadastro-3 | Cadastro — Coordenada impossível | Aprovado |
| ADV-cadastro-4 | Cadastro — Capacidade negativa | Aprovado |
| ADV-cadastro-5 | Cadastro — E-mail inválido | Aprovado |
| ADV-solicitacao-1 | Solicitação — Sem material | Aprovado |
| ADV-solicitacao-2 | Solicitação — Quantidade negativa | Aprovado |
| ADV-solicitacao-3 | Solicitação — Data textual inválida | Aprovado |
| ADV-solicitacao-4 | Solicitação — Coordenada incompleta | Aprovado |
| ADV-solicitacao-5 | Solicitação — Gerador inexistente | Aprovado |

### Operacionais: 6 grupos × 10 situações

| ID | Situação executada | Resultado |
|---|---|---|
| OP-geradores-1 | geradores — CPF classifica residencial sem conta PF | Aprovado |
| OP-geradores-2 | geradores — CNPJ distingue pequeno gerador no mesmo cadastro | Aprovado |
| OP-geradores-3 | geradores — Sem acesso ativo não impede cooperativa registrar pedido | Aprovado |
| OP-geradores-4 | geradores — Documentação do gerador fica no titular selecionado | Aprovado |
| OP-geradores-5 | geradores — Alterar endereço exige coordenadas em par | Aprovado |
| OP-geradores-6 | geradores — CPF duplicado não cria segundo gerador | Aprovado |
| OP-geradores-7 | geradores — Cadastro não aparece para outra cooperativa | Aprovado |
| OP-geradores-8 | geradores — Consulta por identificação curta da coleta | Aprovado |
| OP-geradores-9 | geradores — Histórico não atribui entrada anônima ao gerador | Aprovado |
| OP-geradores-10 | geradores — Editar nome conserva documento e e-mail | Aprovado |
| OP-solicitacoes-1 | solicitacoes — Solicitação com data e material gera registro | Aprovado |
| OP-solicitacoes-2 | solicitacoes — Delegação vincula equipe, motorista e veículo | Aprovado |
| OP-solicitacoes-3 | solicitacoes — Pedido delegado não pode ser cancelado isoladamente | Aprovado |
| OP-solicitacoes-4 | solicitacoes — Duplicar delegação não cria segunda coleta | Aprovado |
| OP-solicitacoes-5 | solicitacoes — Outro perfil não delega solicitação | Aprovado |
| OP-solicitacoes-6 | solicitacoes — Cooperativa filtra solicitação por ID | Aprovado |
| OP-solicitacoes-7 | solicitacoes — Estado concluído não pode ser forçado no pedido | Aprovado |
| OP-solicitacoes-8 | solicitacoes — ID inexistente não revela dados | Aprovado |
| OP-solicitacoes-9 | solicitacoes — Outra cooperativa não acessa solicitação | Aprovado |
| OP-solicitacoes-10 | solicitacoes — Sem catador a delegação é rejeitada | Aprovado |
| OP-catadores-1 | catadores — Nome e inscrição persistem no cadastro | Aprovado |
| OP-catadores-2 | catadores — Sem vínculo não se atribui produção avulsa | Aprovado |
| OP-catadores-3 | catadores — Catador inválido é rejeitado na delegação | Aprovado |
| OP-catadores-4 | catadores — Equipe com integrante repetido é rejeitada | Aprovado |
| OP-catadores-5 | catadores — Equipe inativa não pode assumir atendimento | Aprovado |
| OP-catadores-6 | catadores — Alterar categoria preserva cadastro e inscrição | Aprovado |
| OP-catadores-7 | catadores — Versão antiga da equipe não sobrescreve participantes | Aprovado |
| OP-catadores-8 | catadores — Catador não edita dados administrativos de outro | Aprovado |
| OP-catadores-9 | catadores — Histórico do participante inclui trabalho em equipe | Aprovado |
| OP-catadores-10 | catadores — Documentos do catador exigem autenticação | Aprovado |
| OP-rotas-1 | rotas — Rota diária gera execuções independentes | Aprovado |
| OP-rotas-2 | rotas — Modalidade por pontos rejeita roteiro vazio | Aprovado |
| OP-rotas-3 | rotas — Modalidade por bairro permite começar sem pontos | Aprovado |
| OP-rotas-4 | rotas — Saída sem motorista e veículo é bloqueada | Aprovado |
| OP-rotas-5 | rotas — Cancelar rota não apaga coletas realizadas | Aprovado |
| OP-rotas-6 | rotas — Próximo dia mantém todos os pontos | Aprovado |
| OP-rotas-7 | rotas — Pontos duplicados impedem plano recorrente | Aprovado |
| OP-rotas-8 | rotas — Intervalo de dias inválido é rejeitado | Aprovado |
| OP-rotas-9 | rotas — Motorista não replaneja a rota administrativa | Aprovado |
| OP-rotas-10 | rotas — Outra cooperativa não altera recursos da rota | Aprovado |
| OP-motoristas-1 | motoristas — Motorista ativo pode ser associado a veículo | Aprovado |
| OP-motoristas-2 | motoristas — Dados de contato podem ser corrigidos | Aprovado |
| OP-motoristas-3 | motoristas — Motorista não consulta localização de colega | Aprovado |
| OP-motoristas-4 | motoristas — Gestor não inicia compartilhamento em nome do motorista | Aprovado |
| OP-motoristas-5 | motoristas — Posição impossível é rejeitada | Aprovado |
| OP-motoristas-6 | motoristas — Relato exige descrição útil | Aprovado |
| OP-motoristas-7 | motoristas — Relato de atraso é registrado no serviço | Aprovado |
| OP-motoristas-8 | motoristas — Histórico do motorista mantém relato registrado | Aprovado |
| OP-motoristas-9 | motoristas — Outra cooperativa não altera disponibilidade | Aprovado |
| OP-motoristas-10 | motoristas — Disponibilidade pode ser atualizada sem apagar CNH | Aprovado |
| OP-veiculos-1 | veiculos — Capacidade e vínculo são preservados na edição | Aprovado |
| OP-veiculos-2 | veiculos — Placa duplicada é rejeitada mesmo em outra grafia | Aprovado |
| OP-veiculos-3 | veiculos — Ano fora do intervalo é rejeitado | Aprovado |
| OP-veiculos-4 | veiculos — Veículo de outra cooperativa não pode ser delegado | Aprovado |
| OP-veiculos-5 | veiculos — Documento vinculado preserva titular | Aprovado |
| OP-veiculos-6 | veiculos — Manutenção fica no histórico do próprio veículo | Aprovado |
| OP-veiculos-7 | veiculos — Estado de manutenção pode ser consultado | Aprovado |
| OP-veiculos-8 | veiculos — Operação não inicia usando veículo em manutenção | Aprovado |
| OP-veiculos-9 | veiculos — Liberação do veículo preserva modelo e placa | Aprovado |
| OP-veiculos-10 | veiculos — Outra cooperativa não apaga ou troca placa | Aprovado |

### Formulários, recebimento e os seis destinos no navegador

| ID | Situação executada | Resultado |
|---|---|---|
| UI-cadastro-catador | Catador — criar e editar cadastro pelo formulário do painel | Aprovado |
| UI-cadastro-motorista | Motorista — criar e corrigir telefone pelo painel | Aprovado |
| UI-cadastro-veiculo | Veículo — criar com motorista, editar capacidade e consultar | Aprovado |
| UI-cadastro-gerador | Gerador — CPF e CNPJ classificam cadastro criado pelo painel | Aprovado |
| UI-cadastro-pev | PEV — salvar identificação e ponto confirmado pelo formulário | Aprovado |
| UI-cadastro-equipe | Equipe — escolher dois participantes e confirmar vínculo no painel | Aprovado |
| UI-cadastro-material | Material — cadastro gera código interno e preserva unidade em português | Aprovado |
| UI-cadastro-lote | Lote — entrada manual cria código e saldo pelo formulário | Aprovado |
| UI-cadastro-manutencao | Manutenção — formulário preserva custo zero e observações | Aprovado |
| UI-cadastro-entregador | Entregador — cadastrar somente nome e corrigir telefone | Aprovado |
| UI-destino-DIRECT_DESTINATION | Destinação — executar DIRECT_DESTINATION pelo modal do painel | Aprovado |
| UI-destino-STOCK | Destinação — executar STOCK pelo modal do painel | Aprovado |
| UI-destino-TRIAGE | Destinação — executar TRIAGE pelo modal do painel | Aprovado |
| UI-destino-RESERVATION | Destinação — executar RESERVATION pelo modal do painel | Aprovado |
| UI-destino-REJECT | Destinação — executar REJECT pelo modal do painel | Aprovado |
| UI-destino-DISPOSAL | Destinação — executar DISPOSAL pelo modal do painel | Aprovado |
| UI-recebimento-destinacao | Entrada anônima — receber, separar, pesar e abrir rastreabilidade | Aprovado |

### PDFs de cadastros, individual e todos

| ID | Situação executada | Resultado |
|---|---|---|
| PDF-collectors-one | PDF de collectors — one | Aprovado |
| PDF-collectors-all | PDF de collectors — all | Aprovado |
| PDF-generators-one | PDF de generators — one | Aprovado |
| PDF-generators-all | PDF de generators — all | Aprovado |
| PDF-drivers-one | PDF de drivers — one | Aprovado |
| PDF-drivers-all | PDF de drivers — all | Aprovado |

### Busca sem resultado em cinco gestões

| ID | Situação executada | Resultado |
|---|---|---|
| UI-gestao-busca | Cinco gestões — filtros vazios e busca sem resultado não misturam entidades | Aprovado |

### Cinco relatórios × cinco verificações funcionais

| ID | Situação executada | Resultado |
|---|---|---|
| REL-overview-1 | Relatório overview — aplicar período com dados reais da cooperativa | Aprovado |
| REL-overview-2 | Relatório overview — exportar PDF do recorte completo | Aprovado |
| REL-overview-3 | Relatório overview — exportar planilha Excel válida | Aprovado |
| REL-overview-4 | Relatório overview — salvar e restaurar filtros do próprio usuário | Aprovado |
| REL-overview-5 | Relatório overview — período invertido não permite exportação | Aprovado |
| REL-collections-1 | Relatório collections — aplicar período com dados reais da cooperativa | Aprovado |
| REL-collections-2 | Relatório collections — exportar PDF do recorte completo | Aprovado |
| REL-collections-3 | Relatório collections — exportar planilha Excel válida | Aprovado |
| REL-collections-4 | Relatório collections — salvar e restaurar filtros do próprio usuário | Aprovado |
| REL-collections-5 | Relatório collections — período invertido não permite exportação | Aprovado |
| REL-waste-1 | Relatório waste — aplicar período com dados reais da cooperativa | Aprovado |
| REL-waste-2 | Relatório waste — exportar PDF do recorte completo | Aprovado |
| REL-waste-3 | Relatório waste — exportar planilha Excel válida | Aprovado |
| REL-waste-4 | Relatório waste — salvar e restaurar filtros do próprio usuário | Aprovado |
| REL-waste-5 | Relatório waste — período invertido não permite exportação | Aprovado |
| REL-staff-1 | Relatório staff — aplicar período com dados reais da cooperativa | Aprovado |
| REL-staff-2 | Relatório staff — exportar PDF do recorte completo | Aprovado |
| REL-staff-3 | Relatório staff — exportar planilha Excel válida | Aprovado |
| REL-staff-4 | Relatório staff — salvar e restaurar filtros do próprio usuário | Aprovado |
| REL-staff-5 | Relatório staff — período invertido não permite exportação | Aprovado |
| REL-vehicles-1 | Relatório vehicles — aplicar período com dados reais da cooperativa | Aprovado |
| REL-vehicles-2 | Relatório vehicles — exportar PDF do recorte completo | Aprovado |
| REL-vehicles-3 | Relatório vehicles — exportar planilha Excel válida | Aprovado |
| REL-vehicles-4 | Relatório vehicles — salvar e restaurar filtros do próprio usuário | Aprovado |
| REL-vehicles-5 | Relatório vehicles — período invertido não permite exportação | Aprovado |

### Sessão, perfil, expiração e recuperação

| ID | Situação executada | Resultado |
|---|---|---|
| AUTH-guest | Sessão — guest | Aprovado |
| AUTH-expired | Sessão — expired | Aprovado |
| AUTH-temporary | Sessão — temporary | Aprovado |
| AUTH-role | Sessão — role | Aprovado |
| AUTH-mid-session | Sessão — mid-session | Aprovado |

## Regressões adicionais

### Conclusão, conversão de reserva e buscas

- Aprovado: Destinação direta finaliza o material e permite concluir coleta recebida, com confirmação explícita e sem triagem artificial
- Aprovado: Resíduos coletados encontra código curto, #código, identificador completo e número da solicitação
- Aprovado: Solicitações permite pesquisar seu protocolo e o código da coleta vinculada
- Aprovado: Reserva de coleta concluída pode virar destino direto, mantém conclusão e histórico e impede alteração após etapa final
- Aprovado: Filtro de materiais em acompanhamento permanece acessível e sem transbordamento em 390 px
- Aprovado: Sem erros JavaScript nos fluxos completos de conclusão, conversão e busca

### Ordens de serviço e documentos internos

- Aprovado: Central acessível pelo menu, O.S. agrupada com três pontos, situações e motivo do cancelamento
- Aprovado: Visualização e download da O.S. usam a versão preservada, com programação e documentos internos
- Aprovado: Filtro por tipo, comprovante de saída em litros, destinatário e O.S. de origem
- Aprovado: Consulta por lote encontra o documento vinculado à saída
- Aprovado: Comprovante de coleta disponível na referência da coleta
- Aprovado: Tela adaptada a 390 px e navegação sem erros JavaScript

