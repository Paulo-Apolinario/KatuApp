# Interface do app, mapa do motorista e comprovantes — 22/10/2026

## Contexto e escopo

Paulo solicitou uma reformulação visual após revisar as telas de entrada, seleção do gerador, login dos perfis e o bloco de pontos do mapa do motorista, além do comprovante consolidado emitido pelo catador.

A entrega anterior (`melhorias-gerais-app-2026-10-22.md`) corrigiu contratos, sessão, operação, fila offline, rotas e mapas, com uma padronização visual parcial. Não havia redesenhado individualmente todas as telas. Esta entrega acrescenta um redesenho completo do acesso, reorganiza os controles do mapa web e substitui o template de impressão dos comprovantes. A linguagem visual compartilhada é ampliada às telas existentes.

Não há alteração de banco, regra de saldo, permissão ou ciclo operacional nesta entrega. Não há nova migração; a migração da entrega anterior continua necessária para as ocorrências e os endereços de solicitação PF.

## Backlog entregue

| ID | Entrega | Critério |
| --- | --- | --- |
| VIS01 | Entrada com cartões de perfil, ícones, explicação da participação e cooperativa/OSC | Todos os atalhos levam às rotas existentes e preservam o perfil escolhido. |
| VIS02 | Layout de acesso com painel de marca e formulário no desktop; cabeçalho compacto no celular | Navegador de 1.440 px e 390 px sem rolagem horizontal. Conteúdo vertical continua rolável com teclado. |
| VIS03 | Seleção de PF, pequeno e grande gerador redesenhada | Sem exigir GPS para decidir um perfil. Localização continua disponível nos fluxos operacionais que precisam dela. |
| VIS04 | Login dos seis perfis com campos delimitados, modo de entrada segmentado e ações claras | Preservados senha, mostrar/ocultar, lembrar acesso, recuperação, cadastro e link por e-mail. Teste de interface não envia e-mail real. |
| VIS05 | Paleta verde escura, tipografia menos pesada e cabeçalhos consistentes | Padronização de estilos em 80 arquivos existentes de telas/componentes, além das telas novas. As cores de status e as regras de operação permanecem identificáveis por texto. |
| VIS06 | Campos compartilhados indicam foco e leitura restrita | Campos com rótulos, altura de toque e borda de foco; dados não editáveis têm apresentação específica. |
| VIS07 | Lista de pontos web substitui a nuvem de botões | Lista com cinco pontos por lote, busca por nome/endereço, ponto selecionado com endereço e navegação externa, ação Ver todos e legenda GPS/sede/coletas. |
| VIS08 | Seleção independente de GPS, sede e coleta no mapa do motorista | Selecionar sede ou posição do motorista não inventa uma coleta. Ver todos volta ao enquadramento geral. |
| VIS09 | Marcadores distinguem GPS, sede e visitas numeradas | O mapa web evita desenhar duas vezes o marcador-base quando já está na lista no mesmo ponto. A linha pontilhada continua sendo sequência, não percurso viário calculado. |
| VIS10 | Novo comprovante individual e consolidado | Marca discreta, cores de impressão, margens A4, dados organizados, referência completa, período, quantidade de coletas e tabela por unidade. |
| VIS11 | Identificação e texto do comprovante mais precisos | Campo vazio mostra Não informado. Não usa a primeira coleta como prova de início de atuação; apresenta o período do histórico. Não declara certificação de pesagem/destinação que o documento não verifica. |
| VIS12 | Impressão preparada para múltiplas páginas | Cabeçalho da tabela repetido, linhas preservadas, conteúdo extenso sem truncar materiais e orientação para salvar em PDF sem cabeçalhos/rodapés do navegador. |

## Detalhes de implementação

- `AccessShell` e `ProfileChoice` centralizam apresentação e navegação do acesso.
- O login continua usando `AuthContext.signIn` e `authService.requestLoginLink`; a troca de apresentação não cria outro mecanismo de autenticação.
- `MapPointList` apresenta o endereço antes de abrir navegação. Coordenadas técnicas não ocupam a área principal do cartão selecionado. A navegação abre um serviço externo por ação explícita do usuário.
- O mapa continua disponível para seleção de coordenadas em solicitações. A lista web é um complemento; não depende do carregamento dos tiles para apresentar os pontos.
- Os novos modelos de comprovante usam dados do histórico de coletas concluídas. Massa em kg é separada de litros, unidades e m³; toneladas entram como massa convertida.
- Referência completa e identificador da emissão substituem o código curto baseado somente nos primeiros caracteres do usuário. O documento não oferece validação pública ou assinatura digital que ainda não existam no sistema.
- Cooperativa/OSC aparece quando informada no conjunto de dados recebido. Ausência é sinalizada; não é preenchida por suposição.
- Na versão web, a emissão abre a janela de impressão, com botão para repetir a impressão e orientação para desativar os cabeçalhos e rodapés do navegador. Essa configuração pertence ao navegador. No nativo permanece `expo-print` com compartilhamento suportado pelo dispositivo.
- Comprovantes já salvos não são reescritos. O novo layout vale para os gerados após a atualização.

## Validação

As evidências consolidadas ficam em `validacao-visual-app-comprovantes-2026-10-22.json`. Resultado: 27 cenários de API/navegador, 9 regressões de contrato e 4 verificações do template aprovados; TypeScript e ESLint do app aprovados sem erros/avisos; exportações web e JavaScript Android concluídas.

- TypeScript e ESLint do app.
- Regressões de contrato de sessão, catálogo, materiais, PDF, cache e rotas.
- Testes de API e navegador existentes ampliados com telas públicas responsivas, os seis perfis do login, seleção de PEV/sede e controles do mapa.
- Exportação Expo web e bundle JavaScript Android.
- Teste puro do template: `node server/tests/visual-refresh/receipts.cjs`. A variável opcional `KATUA_PDF_QA_OUTPUT` grava HTML de demonstração para renderização, apenas com dados sintéticos.
- PDFs individual, consolidado e de 85 materiais renderizados com Chromium, inspecionados por texto e visualmente. O cenário de 85 materiais gerou cinco páginas com cabeçalho de tabela repetido.

Os testes de navegador bloqueiam chamadas externas e simulam GPS com permissão. Validam apresentação, seleção, fallback e controles; não demonstram funcionamento ao vivo do provedor de mapas nem GPS físico. A exportação Android valida o bundle, não a instalação de APK/AAB.

## Atualização na VPS

1. Atualizar KatuApp e Katua_Web na `main`, preservando ambientes e uploads.
2. Na raiz do KatuApp, instalar dependências e exportar Expo web com `EXPO_PUBLIC_API_BASE_URL=https://vps.katua.com.br`.
3. Publicar o export no diretório já configurado para `app.katua.com.br`. Gerar somente o build Vite do painel não altera o app.
4. Atualizar o navegador para carregar o novo bundle e gerar um comprovante novo. Se continuar vendo o bloco antigo Pontos operacionais, conferir o diretório servido e a exportação efetivamente publicada.
5. Para instalações nativas, distribuir uma compilação atualizada pelo processo do projeto.

Esta entrega de interface não exige reiniciar a API ou aplicar uma nova migração. Se a entrega funcional anterior ainda não foi aplicada, seguir primeiro seu procedimento de atualização de banco/API. Nenhuma alteração foi executada na VPS por Codex.

## Pendências reais

| Prioridade | Pendente | Situação |
| --- | --- | --- |
| P1 | Homologar Android/iOS físicos | GPS, teclado, áreas seguras, leitor de tela, cofre de token e impressão precisam de teste nos aparelhos usados pela equipe. |
| P1 | Confirmar publicação no ambiente do usuário | Acesso à VPS e configuração final do Nginx não foram disponibilizados; Paulo executa a atualização. |
| P2 | Revisão individual das telas legadas | A paleta e o peso da tipografia foram padronizados, mas cada formulário/tela ainda pode exigir revisão de composição, foco, responsividade e estados vazios. Isso não equivale a redesenho individual de todas as rotas. |
| P2 | Mapas com grande volume | Busca/lotes reduzem a lista visual; agrupamento de marcadores e testes de carga permanecem como evolução a medir. |
| P2 | Dados históricos incompletos | Endereço, coordenadas, CPF e cooperativa ausentes devem ser corrigidos no cadastro, sem inventar informações no comprovante. |
| P3 | Recursos anunciados como indisponíveis | Chat, NFC, comércio e rastreamento remoto não foram implementados nesta reforma visual. |

## Próxima revisão sugerida

Depois da publicação e validação pela equipe, revisar individualmente as telas operacionais mais usadas: início de cada perfil, execução da coleta, detalhes de rota, histórico/comprovantes e recebimento. A base visual agora pode ser reutilizada sem repetir o trabalho de padronização em cada tela.
