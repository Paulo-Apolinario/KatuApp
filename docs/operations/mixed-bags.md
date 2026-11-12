# Bags misturadas e triagem — novembro de 2026

## Operação disponível

Painel: Gestão de resíduos → Triagem e bags. App da cooperativa: Triagem e bags. App do catador: Triagem e lotes, com a mesma conta usada nas coletas. O rodízio não exige outro perfil. Em aparelho compartilhado, use Trocar catador antes de mudar o responsável.

1. Receber bag: bruto menos tara = líquido. Informe a origem e, se conhecidos, geradores. Uma bag física pode ter identificação reutilizável depois do encerramento.
2. Opcionalmente vincular a uma coleta COLLECTED ainda não recebida, sem materiais nem peso, ou a um recebimento de bags ainda aberto. Não converter uma coleta já pesada nem registrar novamente material já recebido.
3. Pesar cada material separado, selecionar item do catálogo em kg e criar ou complementar lote disponível triado/armazenado do mesmo material. Informar participantes reais. Rejeitos exigem descrição.
4. Fazer novas pesagens durante a triagem parcial. Concluir somente quando material separado + rejeitos = peso líquido. Uma coleta com várias bags encerra após a conclusão de todas as bags válidas.
5. No estoque, consultar as bags que compõem o lote e utilizar a destinação por quantidade existente, inclusive retirada parcial. O comprovante consolidado preserva a composição das entradas das bags. Esta composição não representa o rateio de uma saída parcial de material misturado.

Somente o gestor ajusta bruto/tara ou cancela bag sem triagem, pelo painel web, com justificativa. Ajuste não pode reduzir o líquido abaixo do já processado. Pesagens e eventos preservam antes/depois, responsável, equipe e protocolo; uma bag encerrada não é editada pelos fluxos antigos.

## Contagem e impacto

O recebimento misturado tem uma Collection canônica, intakeKind MIXED_BAG. reportedTotalWeightKg guarda o líquido recebido. totalWeightKg e CollectionMaterial guardam somente os materiais identificados na triagem. A separação não cria uma segunda coleta. A bag não vira estoque antes da triagem.

Não somar recebido e separado: são etapas do mesmo material. Litros/unidades não são convertidos em kg. O perfil declarado do catálogo é preservado e não é elevado automaticamente a identificação técnica verificada. A estimativa ambiental segue os fatores e critérios já existentes para os materiais identificados.

Várias origens sem pesagem individual ficam registradas sem inventar divisão de massa/impacto por gerador. Participar da triagem não gera parcela individual de produção nem incrementa o indicador de kg coletados na rua pelo catador. O histórico operacional informa quem lançou e quem participou.

Complementar um lote preserva as novas entradas em MixedBagOutput, mesmo quando o lote tem outra coleta de origem. O painel e o documento consolidado mostram essas entradas; não assumir que a origem inicial do lote representa toda a composição de um lote complementado. Não há identificação física automática de qual bag saiu primeiro de um lote misturado.

## Conexão e acesso

Confirmações exigem conexão. Os formulários recebem protocolo UUID e guardam rascunho por usuário/aparelho. Repetir a mesma confirmação com o mesmo protocolo e dados não duplica estoque. Mudança concorrente de bag/lote exige revisão. Não há envio automático de pesagens offline. Após falha de rede, conferir histórico/protocolo antes de iniciar outra operação.

Cooperativa e catadores ativos acessam somente dados da própria cooperativa. Catador registra recebimento/triagem e conclui bags; ajuste/cancelamento de recebimento e saída de estoque permanecem restritos ao gestor. O catálogo consultável pelo catador não concede edição do catálogo.

## Atualização acumulada da VPS

Não executar reset de banco nem prisma db push. Aplicar migrations pendentes na ordem pelo prisma:deploy; inclui cadastro rápido, acesso por celular e 20261112210000_mixed_bag_sorting. A migration nova adiciona tabelas/índices/relações; não reclassifica nem apaga registros anteriores.

API, uma linha:

```sh
cd /var/www/katua/app && git pull --ff-only origin main && cd server && npm ci --include=dev && npm run prisma:generate && npm run prisma:deploy && npm run check && npm run build && sudo systemctl restart katua-api.service && sudo systemctl is-active katua-api.service
```

App web/PWA, uma linha após API:

```sh
cd /var/www/katua/app && git pull --ff-only origin main && npm ci --include=dev && EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br npm run export:web
```

Painel, uma linha após API:

```sh
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

O APK instalado exige nova compilação/distribuição para receber as telas novas. Atualização da VPS não substitui o APK.

## Verificação local

`npm run check` e `npm run build` no server; `npm run check` e export:web no app; eslint dos componentes alterados e build no painel. Testes API usam PostgreSQL descartável PGlite local, nunca produção:

```sh
KATUA_VALIDATION_TOOLS=/caminho/ferramentas node tests/mixed-bags/run.mjs
```

Cobrem migration incremental preservando dados anteriores; precisão decimal; triagem parcial/rejeitos; criação/complementação de lotes; reenvio e concorrência; várias bags/uma coleta; origem incerta; permissões; isolamento; bloqueios de fluxos antigos; retirada parcial e composição no documento. Conferência de interface com respostas sintéticas da API validou painel e aplicativos, restauração de rascunho e troca de usuário.
