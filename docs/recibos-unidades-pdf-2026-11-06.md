# Histórico e comprovantes por unidade

O histórico do catador e os comprovantes individual/consolidado mostram totais separados por unidade. Exemplo: óleo 80 L permanece 80 L; uma coleta com papelão e óleo mostra ambos os totais, sem converter litros em kg. O resumo em massa deixa de substituir quantidades de materiais não pesáveis.

No App Web, o comprovante é gerado como PDF vetorial local e abre uma visualização com **Baixar PDF**. Não dispara impressão nem exige escolher “Salvar como PDF” no navegador. Nome do arquivo contém referência e data. Mantém histórico completo paginado, quantidades originais/conferidas, observações e aviso de documento interno. Em navegadores sem visualizador PDF integrado, apresenta uma visualização HTML estática do mesmo conteúdo e mantém o download do PDF real. Não depende de pop-up, fonte externa ou serviço de geração de PDF.

No aplicativo nativo, permanece a geração local em PDF e o compartilhamento do arquivo. Não há alteração em registros existentes, unidades armazenadas ou API.

Dependências Web: jsPDF/autotable, carregadas na geração; importação explícita do módulo de navegador para compatibilidade com a exportação SSR do Expo. Atualizar dependências com `npm ci --include=dev` antes de exportar o App Web.

Validação: TypeScript, ESLint, exportação Expo/PWA; 19 cenários de navegador (incluindo fluxo do catador, unidades, visualização/download, ausência de impressão automática e consolidado); 4 verificações semânticas de PDF com Poppler (óleo, unidades mistas, conferência e paginação de 85 materiais); testes existentes de template e histórico de conferência; 11 contratos do App. Dados de teste sintéticos, sem acesso à VPS.

Comandos de testes adicionais: em `server`, `node --import tsx tests/visual-refresh/receipt-pdf.cjs` (requer Poppler local). A visualização/download também é exercitada por `tests/collector-web/browser.mjs` contra o build exportado, com APIs simuladas.

Sem migração de banco ou alteração no backend. Deploy manual: atualizar o repositório KatuApp e exportar o App Web. Preservar o build anterior para rollback; reverter build não altera o histórico de coletas.
