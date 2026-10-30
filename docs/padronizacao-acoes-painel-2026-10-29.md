# Padronização das ações do painel — 29/10/2026

## Resultado

Revisão dos links e controles de ação nas páginas e componentes do painel web. Foram padronizadas 48 ações em 22 arquivos JSX com o botão pequeno de borda verde usado em “Analisar”.

- Painel operacional: Acompanhar rota/coleta, Abrir calendário, Conferir coleta, Abrir gestão, Ver pendências, Ver operação, conferência, análises e localização de cadastros.
- Coletas e rotas: consultas, atalhos entre solicitações e materiais, execução de rota, cadastro de pontos e complementação de localização.
- PEVs: consultar cadastro, abrir coleta, entrada/destinação, corrigir localização e Como chegar.
- Resíduos: consultar entradas, lotes e destinações; voltar para o estoque completo.
- Equipes, documentos de veículos, ordens extras e configurações: ações que ainda apareciam como texto.
- Relatórios: valor do indicador preservado; ação apresentada como botão “Ver detalhes”, com descrição acessível do indicador.

Grupos de ações em coletas, documentos e operação em campo têm espaçamento e quebra de linha. Links continuam sendo links com aparência de botão, preservando abrir em nova aba e navegação por teclado. Controles que executam ações continuam sendo botões.

Navegação lateral, breadcrumbs, cartões clicáveis do calendário, fotografias para download e atribuições cartográficas conservam seus controles próprios. A revisão é visual; não altera permissões, API, banco, fluxo operacional ou telas do App.

## Validação

- ESLint dos arquivos JSX alterados: aprovado.
- Build Vite de produção: aprovado. Aviso anterior de bundle acima de 500 kB permanece.
- Auditoria AST comparando com a versão anterior: 82 destinos de links e 151 callbacks preservados, incluindo atributos de desabilitação e abertura em outra aba.
- Conferência em Chromium local, com API simulada, nas larguras 1366 e 390 px: resultado registrado no JSON desta entrega. Verificados borda, espaçamento, foco, destino e encaixe no viewport, além da abertura do calendário.
- A validação visual usa dados simulados e não substitui testes de negócio de cada módulo. Nenhum acesso à VPS foi realizado.

## Atualização da VPS pelo responsável

Executar em uma linha:

```bash
cd /var/www/katua/frontend && git pull --ff-only origin main && cd frontend && npm ci --include=dev && VITE_API_BASE_URL=https://vps.katua.com.br npm run build
```

Atualizar o navegador com Ctrl+Shift+R. Esta entrega não exige migração ou reinício da API.

## Acompanhamento

- [ ] Após a publicação na VPS, conferir com uma cooperativa os atalhos do painel inicial e as ações nas listas.
- [ ] Validar em dispositivo físico a disposição dos grupos de botões.
- O relato anterior de versão antiga do Gerador residencial foi esclarecido pelo usuário: faltava reiniciar/reabrir o App após a atualização. Não prosseguir com investigação de Nginx sem novo indício.
