# Marcadores e complementação da localização de geradores — 21/10/2026

## Solicitação e diagnóstico

Trocar a bolinha do mapa do painel por um marcador mais profissional e permitir completar a localização de um gerador cadastrado sem latitude/longitude. As três imagens anexadas foram abertas e conferidas.

O painel já listava cadastros sem coordenadas com o acesso “Completar localização”, mas a edição não oferecia mapa/campos de coordenadas. No backend do repositório, a rota `PATCH /generators/:id` usada pelo serviço de edição também não estava implementada. Não foram atribuídas coordenadas estimadas aos registros existentes automaticamente.

## Entrega

- Pinos SVG com contorno branco, sombra e símbolo interno. Verde/edificação para geradores, âmbar/reciclagem para PEV, azul/casa para sede e roxo/localização para o aparelho. Legenda com símbolos e texto, sem depender apenas de cor. Popups e nomes continuam em nós de texto, sem interpolar dados do cadastro no HTML do ícone.
- Identificação interna de marcadores combina tipo e ID para evitar colisões entre gerador, PEV e sede.
- “Completar localização” de um gerador abre a edição com foco na seção de localização. Ao salvar vindo do painel, retorna ao painel, que consulta os dados atualizados.
- Edição com mapa Leaflet/OpenStreetMap: clique para selecionar, pino arrastável e campos de latitude/longitude. A gravação ocorre com “Salvar alterações”; não exige uma segunda confirmação do mapa.
- Busca de CEP na edição preenche o endereço e preserva o número informado. Não transforma CEP em localização exata.
- Busca de endereço no mapa reutiliza a integração Google Maps já usada no cadastro, incluindo rua, número, bairro, cidade, UF e CEP. O resultado é uma sugestão ajustável. Essa busca depende da chave/permissões existentes do Google; a seleção manual do ponto e o mapa de edição não dependem dessa chave.
- Tempo de espera limitado para buscas e proteção contra resposta antiga substituindo uma coordenada/endereço ajustado pelo usuário. Falha de mapa-base mantém os campos de coordenadas disponíveis.
- Novo `PATCH /generators/:id`, autenticado e limitado ao gerador da cooperativa ativa. Campos permitidos explícitos; rejeita mudança de e-mail/cooperativa/acesso pelo payload desta rota. Latitude e longitude devem ser enviadas juntas, finitas, nos limites geográficos. Zero é válido.
- Alteração de dados sem enviar coordenadas preserva a localização existente. A edição não oferece exclusão de localização já gravada; permite substituí-la por outro ponto válido.
- Cadastro inicial mantém seu fluxo de confirmação Google Maps; compartilha as funções de carregamento/busca com a edição. A validação do cadastro agora aceita coordenadas zero.

## Validação

- API: `npm run check` e `npm run build` aprovados.
- Painel: lint dos arquivos alterados e `npm run build` aprovados. Persiste o aviso anterior de tamanho de bundle do Vite.
- Nove cenários de integração aprovados no runner `frontend/tests/dashboard-browser.mjs`, com API Fastify/Prisma real, banco PGlite descartável e Chromium. Incluem os seis cenários anteriores do painel e três conjuntos novos: recuperação da localização pelo painel, busca/ajuste/persistência e autorização/validação da API.
- Testado salvar um gerador originalmente sem coordenadas, conferir os valores pela API, recarregar e abrir o marcador. Testada edição de um gerador já localizado, preservando o e-mail. Testadas coordenadas zero, par incompleto, limites inválidos, null, campos não permitidos, perfil motorista e outra cooperativa.
- Busca externa de CEP e resposta do geocoder Google foram simuladas nos testes para conferir composição de endereço, número e persistência sem chamadas públicas. A aceitação da chave Google real deve ser conferida no ambiente publicado.
- Capturas em desktop/celular inspecionadas; sem transbordamento horizontal na edição móvel. Tiles externos bloqueados de propósito nos testes para conferir o comportamento com mapa-base indisponível.
- Resultado: [validacao-marcadores-localizacao-geradores-2026-10-21.json](validacao-marcadores-localizacao-geradores-2026-10-21.json).

## Implantação

Atualizar `main` de KatuApp e Katua_Web. Compilar a API em `/var/www/katua/app/server`, reiniciar `katua-api.service` e compilar o painel em `/var/www/katua/frontend/frontend`, preservando as configurações existentes. Nenhuma nova migração, variável obrigatória ou atualização do Expo é necessária para esta entrega. Publicar somente o painel sem a API deixa o salvamento sem a nova rota.

Conferência no ambiente: painel → mapa → gerador sem coordenadas → Completar localização → definir/ajustar ponto → Salvar alterações → Localizar no mapa. Os cadastros reais só são alterados quando o responsável salva o ponto; não houve alteração de dados da VPS nesta entrega.

## Backlog

- [x] Substituir bolinhas por pinos identificados no mapa operacional.
- [x] Completar localização depois do cadastro, com acesso direto pelo painel.
- [x] Permitir seleção/arraste e coordenadas manuais na edição.
- [x] Buscar CEP e sugerir ponto pelo endereço com número.
- [x] Persistir localização pela API com isolamento por cooperativa.
- [x] Verificar recarga, layout móvel, coordenadas zero e erros de validação.
- [ ] Conferir a chave Google e a busca real no domínio do painel após implantação.
- [ ] Responsável revisar os geradores existentes sem coordenadas e salvar os pontos corretos.
