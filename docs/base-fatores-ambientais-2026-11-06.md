# Base automática de fatores ambientais

## Fonte e cenário

Base: US EPA, WARM v16, dezembro de 2023, Management Practices Chapters, quadros 1-1 e 7-12 (páginas do PDF 6–7 e 107–108). Documento oficial: https://www.epa.gov/system/files/documents/2024-01/warm_management_practices_v16_dec.pdf . SHA-256 consultado: edaf1f0da21793668e1948043ea623e3e051707127bd6116a0c7d16a372c0e5d . Versão interna imutável: `epa-warm-v16-2023-12-katua-1`.

O cenário compara aterro modelado nos Estados Unidos e reciclagem, incluindo os créditos de substituição de produção primária previstos no WARM. É uma referência internacional para potencial, sem calibração no Ceará, sem medir reciclagem efetiva ou gerar crédito de carbono. Papel incorpora hipóteses de carbono florestal. Não se acrescentam novamente créditos de produção primária, transporte ou perdas já incluídos no WARM. A quantidade é a entrada da coleta, não a quantidade posterior à reciclagem.

Valores originais e cenários permanecem em `server/src/modules/impact/reference-factors.ts`; CO2e/kg = (emissões aterro − emissões reciclagem) × 1000 / 907,18474. Energia equivalente (kWh/kg) = (energia aterro − energia reciclagem) × 293,0710701722222 / 907,18474. A massa da fonte é **short ton**, não tonelada métrica. Btu utiliza a conversão International Table (1055,05585262 J). Não se usa valor absoluto nem se aplica o crédito duas vezes.

Há 12 cenários: latas e lingotes de alumínio, latas de aço, fios de cobre, vidro de embalagem, PEAD, PET, PP, papelão ondulado, papel misto, papel de escritório e jornal. Materiais genéricos não recebem automaticamente cenários específicos: panela/bloco/misto de alumínio não vira lata ou lingote; cobre sem apresentação não vira fio. Papelão genérico utiliza a aproximação de papelão ondulado e papel sem subtipo a de papel misto, identificadas na interface.

O estudo brasileiro do IPEA (2010), Pesquisa sobre Pagamento por Serviços Ambientais Urbanos para Gestão de Resíduos Sólidos, também foi consultado: https://antigo.mma.gov.br/estruturas/253/_arquivos/estudo_do_ipea_253.pdf . Sua tabela 8 informa captação na produção primária, não uma diferença líquida comprovada de água economizada. Por isso esses valores não foram introduzidos como economia de água. O WARM utilizado não fornece os indicadores de água ou árvores, que permanecem nulos.

## Aplicação automática e configuração

Sem metodologia própria validada, a rota ambiental usa a referência automática. Uma configuração própria aprovada é preservada. A seleção explícita `methodology.calculationMode` aceita REFERENCE, CUSTOM ou DISABLED; não há alteração de schema nem nova migração. Rascunhos não aprovados e sem seleção explícita não bloqueiam a referência automática; escolher CUSTOM exige suas conferências e validações anteriores, sem substituir silenciosamente seus fatores.

A correspondência usa material declarado e descrições conhecidas do catálogo, inclusive subcategoria. Registros legados podem usar uma correspondência de referência sem reclassificação técnica ou alteração de suas identificações. Nome, categoria e material conflitantes, identificação revisada explicitamente como desconhecida, classe perigosa/contaminantes e apresentações incompatíveis ficam pendentes. Cor ou objeto isoladamente não comprovam polímero. O filtro por material considera a correspondência de referência e a expõe no detalhe da linha.

A referência estima potencial sobre a quantidade registrada, preservando a separação entre massa conferida e provisória (`referenceProvisionalMassKg`). Quantidade zero ainda não conferida não gera estimativa zero presumida. Litros/unidades/m³ continuam fora dos fatores por kg. Diagnósticos explicam as exclusões. Não se alteram coletas, perfis técnicos, revisões de quantidade, estoque ou documentos para viabilizar cálculos.

Painel, resumo do app e relatórios usam a mesma escolha de mecanismo. A interface informa fonte, versão, cenário e limites; permite consultar a tabela. PDF identifica a metodologia e os materiais de referência, e Excel inclui a aba Base de fatores com valores originais e convertidos. Saldo continua atual e saídas continuam pela data da destinação, sem duplicar benefícios.

## Validação e publicação

70 verificações: 17 da base/conversões/segurança de correspondência; 16 do cálculo próprio; 3 de ausência/abrangência; 16 de API real Fastify/Prisma em PostgreSQL descartável; 5 de calendário/unidades; 13 da interface, exportações e celular. TypeScript/build do backend e build/lint direcionado do painel. Sem acesso à VPS e sem coeficientes externos consultados em tempo de execução.

Atualizar backend, painel e export web do app pelos processos existentes. Esta entrega não cria migração; `prisma:deploy` continua válido para aplicar migrações anteriores eventualmente pendentes. APK instalado precisa receber uma compilação atualizada para exibir as novas explicações da referência.
