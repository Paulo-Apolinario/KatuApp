// Não presumir endpoints ou autenticação atuais a partir de cópias antigas.
// Um adaptador só deve ser registrado após contrato oficial e homologação.
export function integrationCapabilities() {
  return {
    provider: "SINIR",
    status: "PENDING_OFFICIAL_CONTRACT",
    authenticated: false,
    canIssueMtr: false,
    canIssueCdf: false,
    canSubmitMunicipalDeclaration: false,
    reason:
      "A transmissão oficial depende da especificação vigente da API, habilitação e autorização da organização. Os dados podem ser preparados e revisados no KATUÁ.",
    requirements: [
      "Contrato técnico oficial vigente para cada módulo",
      "Autorização e unidade da organização no SINIR",
      "Credenciais de integração próprias; não informar senha Gov.br no KATUÁ",
      "Homologação de emissão, consulta, download e prevenção de duplicidades",
    ],
  };
}
