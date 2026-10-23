// Contrato de leitura identificado no Swagger oficial. Escritas seguem indisponíveis.
export function integrationCapabilities() {
  return {
    provider: "SINIR",
    status: "READ_ONLY_ADAPTER",
    authenticated: false,
    canIssueMtr: false,
    canIssueCdf: false,
    canSubmitMunicipalDeclaration: false,
    reason:
      "Autenticação e catálogos podem ser consultados após configurar a credencial da unidade no servidor. A emissão continua bloqueada até confirmar o ambiente e homologar os contratos de escrita.",
    requirements: [
      "Configuração privada e vínculo da credencial ao CNPJ e à unidade selecionada",
      "Confirmação oficial do ambiente de testes e permissões da organização",
      "Validação dos modelos de MTR, MTR-LR e CDF contra respostas reais",
      "Homologação de emissão, consulta, download e prevenção de duplicidades",
      "Confirmação específica de API para declaração municipal",
    ],
  };
}
