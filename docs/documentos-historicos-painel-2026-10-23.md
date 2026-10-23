# Documentos, históricos e comprovantes do painel — 23/10/2026

## Resultado
Documentos e histórico operacional passaram a ter telas separadas. Geradores, motoristas, catadores e veículos possuem uma área de anexos vinculados ao respectivo cadastro. Os formulários antigos de documentação e manutenção de veículos continuam disponíveis e usam os veículos da API atual.

## Entregue
- [x] Seleção do proprietário antes de consultar ou anexar documentos, com atalhos nas listas de cadastros e menus.
- [x] Upload de PDF, JPG, PNG e WEBP até 10 MB; nome, tipo, identificação, emissão, validade e observações.
- [x] Download autenticado, validação da cooperativa responsável, formato do conteúdo e limite de tamanho no servidor.
- [x] Modelo `OwnerDocument`, com chaves estrangeiras para o proprietário e a cooperativa, e restrição para exatamente um proprietário.
- [x] Arquivos desta nova área fora da pasta pública, com nomes internos aleatórios e nome original preservado no download.
- [x] Compatibilidade com os anexos anteriores de catadores, documentos de veículos e comprovantes de manutenção, sem apagar registros.
- [x] Registros documentais antigos de veículos mantidos em `/vehicle-document-registers`, com edição do vínculo. Registros anteriores sem veículo continuam nessa lista e podem ser vinculados pela edição.
- [x] Ficha anterior do catador preservada em `/collector-profile`, incluindo a gestão da situação cadastral.
- [x] Corrigida a leitura de `response.vehicles` nos quatro formulários de criação/edição de documentos e manutenções.
- [x] Corrigidos downloads antigos que apontavam para `/images/...`; agora passam pela rota autenticada do documento ou manutenção.
- [x] Novos uploads dos formulários de veículos/manutenção também privados, com limpeza do arquivo quando o cadastro falha. O vínculo do veículo é obrigatório.
- [x] Histórico de geradores exibido somente após seleção de um ou mais geradores. Mesmo padrão para motoristas, catadores e veículos.
- [x] Pesquisa de cadastros, filtros de período/status, paginação e consulta das ações registradas na coleta.
- [x] PDF de cada coleta e de cada ação registrada; botão **Salvar coleta em PDF** no detalhe da lista de coletas.
- [x] PDF com origem/endereço, equipe, veículo/rota, materiais e suas unidades reais, situação atual, datas/responsáveis, ocorrências e observações. Dados ausentes permanecem identificados como não informados.
- [x] Navegação e tema visual padronizados, separando explicitamente **Documentos** e **Histórico de coletas**.

## Armazenamento e implantação
- Migração: `20261023180000_owner_documents` no KatuApp.
- Diretório padrão da API: `server/storage/documents`, relativo ao diretório de execução do servidor. No deploy atual: `/var/www/katua/app/server/storage/documents`.
- Variável opcional `DOCUMENT_STORAGE_DIR` para um caminho absoluto diferente. Não precisa adicionar ao `.env` quando for usado o padrão.
- A API precisa ter permissão de escrita nessa pasta, que será criada automaticamente no primeiro upload. A pasta é dado persistente e não é versionada no Git.
- O banco guarda os metadados e vínculos; os arquivos físicos ficam no disco da VPS. A cópia de segurança deve incluir o banco, a pasta privada e os anexos anteriores em `server/uploads`.
- Arquivos anteriores não foram movidos fisicamente. Os novos formulários podem baixá-los por autenticação; URLs públicas antigas não são removidas automaticamente nesta atualização.
- Atualizar KatuApp/backend, executar `prisma:generate` e `prisma:deploy`, compilar/reiniciar a API; depois atualizar e compilar Katua_Web/frontend. Não é necessário exportar novamente o aplicativo Expo para esta mudança do painel.
- Não alterar nem apagar `.env`, arquivos enviados ou dados da VPS durante o deploy.

## Validação

Validação local concluída: **19 cenários aprovados**, incluindo migração SQL, API real, operações no navegador e conferência dos PDFs. Builds da API e painel e verificações de TypeScript/ESLint concluídos sem erros. O Vite mantém o aviso anterior de tamanho do bundle.
`frontend/tests/documents-upgrade.mjs` usa PostgreSQL descartável com PGlite, migração SQL real, API real e Chromium. Requer as dependências QA PGlite/PGlite Socket, Playwright/@sparticuz/chromium e Poppler. Execução: `KATUA_APP_DIR=/caminho/KatuApp KATUA_VALIDATION_TOOLS=/caminho/qa node frontend/tests/documents-upgrade.mjs`.

Cenários: upload/vínculo/download para os quatro proprietários; isolamento entre cooperativas e papéis; arquivos e datas inválidos; limite de 10 MB; restrição de proprietário no banco; compatibilidade anterior; armazenamento privado e limpeza em falhas; anexos do catador; upload pelo painel; telas de motorista/catador; seleção de veículos na criação e edição; PDFs da coleta/ação/detalhe; filtros de histórico, múltiplos geradores e unidades/paginação dos PDFs.

Build da API, TypeScript e build do painel, ESLint dos arquivos alterados e inspeção visual dos PDFs integram a validação. As verificações locais não substituem a conferência da permissão de escrita e dos arquivos antigos na VPS.

## Backlog
- [ ] Conferir na VPS a migração, permissão de escrita, upload e download de um documento por tipo de cadastro.
- [ ] Conferir os anexos históricos reais após o deploy, especialmente os registros sem proprietário.
- [ ] Incluir a pasta privada na rotina de backup e testar uma restauração.
- [ ] Planejar a migração dos documentos antigos ainda públicos para armazenamento privado, mantendo compatibilidade com os acessos do app.
- [ ] Evoluir, se necessário, para versionamento de anexos, política de retenção e armazenamento externo.
