# Endereço e confirmação de localização das O.C.s — 23/10/2026

## Objetivo
Permitir informar o endereço de uma coleta extra pelo CEP ou manualmente e confirmar expressamente um ponto escolhido no mapa, inclusive quando sugerido pelo GPS.

## Entregue
- [x] Consulta de CEP pelo ViaCEP com validação de oito dígitos, tratamento de CEP inexistente e falha de conexão.
- [x] Campos editáveis de rua, número/S/N, complemento/referência, bairro, município e UF; composição do endereço enviado na O.C.
- [x] Endereço completo editável, inclusive sem internet ou sem CEP. Coordenadas continuam opcionais.
- [x] Seleção provisória no mapa e pelo GPS; tocar no mapa não grava coordenadas no payload.
- [x] Botão **Confirmar endereço e ponto**: exige endereço informado e grava o ponto e a precisão disponível.
- [x] Botão **Cancelar seleção**: descarta o ponto provisório e preserva a localização anteriormente salva.
- [x] Envio da O.C. bloqueado enquanto a seleção aguarda confirmação/cancelamento ou há consulta de CEP/GPS em andamento.
- [x] Edição do endereço remove coordenadas anteriores. Trocar o gerador descarta a seleção provisória, limpa o formulário auxiliar e a precisão do GPS anterior.
- [x] Campos auxiliares de endereço preservados no rascunho local, junto do endereço e das coordenadas já confirmadas. Pontos provisórios não são salvos como confirmados.
- [x] Respostas atrasadas de CEP/GPS não substituem alterações posteriores de endereço/origem.

## Validação
- TypeScript do aplicativo e ESLint dos componentes alterados sem erros.
- Exportação Expo web concluída.
- Dez cenários automatizados em Chromium usando o componente real com mapa/GPS/consulta externa controlados: seleção provisória, cancelamento, confirmação, preservação do ponto anterior, composição de CEP/número/complemento, indisponibilidade de CEP, endereço manual, confirmação de GPS, troca de gerador e endereço obrigatório na confirmação.
- Teste reproduzível: `KATUA_VALIDATION_TOOLS=/caminho/qa KATUA_CHROMIUM_PATH=/caminho/chromium node server/tests/extra-orders/address-ui.cjs`, com Playwright e @sparticuz/chromium no diretório QA.
- Testes não substituem a conferência em aparelho físico. O endereço é informado/revisado pelo usuário; não foi acrescentada geocodificação reversa automática.

## Publicação
Somente KatuApp (interface e testes/documentação). Não há mudança de contrato da API nem migração adicional: o endereço composto usa `pickupAddress`, e a confirmação usa latitude/longitude/accuracyMeters existentes. Atualizar o app web ou a distribuição nativa, conforme o acesso utilizado.

## Backlog
- [ ] Conferir a seleção no mapa e a permissão de GPS em aparelho físico.
- [ ] Avaliar futuramente um provedor de geocodificação reversa para sugerir o endereço do ponto selecionado, mantendo revisão humana obrigatória.
