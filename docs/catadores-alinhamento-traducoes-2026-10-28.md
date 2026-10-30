# Catadores — alinhamento e textos do painel

Data: 28/10/2026.

## Backlog entregue

- [x] Alinhar Editar cadastro, Documentos e Histórico em um grupo com espaçamento e altura consistentes. Mesma aparência nos três botões, sem margens verticais isoladas.
- [x] Preservar legibilidade do nome e do e-mail na tabela; rolagem horizontal da tabela quando a largura disponível for insuficiente.
- [x] Remover o bloco Documentos do catador e o botão Gerenciar documentos somente da edição cadastral. A opção de anexar no novo cadastro e os acessos próprios de documentos permanecem disponíveis.
- [x] Reutilizar a tradução central dos estados de coleta em telas antigas de documentos/histórico, calendário operacional e tabela do painel. COLLECTED = Finalizada em campo, RECEIVED = Recebida, SORTING = Em triagem.
- [x] Incluir os estados realizados no filtro do calendário e preservar os códigos originais enviados à API.
- [x] Ajustar a validação de interface existente para conferir a ausência do bloco de documentos na edição.

## Validação e aplicação

ESLint dos arquivos JavaScript/JSX alterados e build de produção do painel aprovados. Reexecutada a validação local de cadastro/edição: 11 verificações de API/migração e 6 de interface. Revisão visual da lista e edição em desktop e largura de 390 px. Sem alteração do banco ou do código de produção da API. Aviso preexistente de bundle acima de 500 kB permanece sem impedir o build.

Atualizar e compilar apenas Katua_Web/frontend na VPS e recarregar o navegador. A alteração no KatuApp é somente a expectativa do teste de interface e este backlog; não exige migração, reinício da API nem exportação do App.
