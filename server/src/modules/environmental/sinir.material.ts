/** Preserva identificadores do catálogo sem remover a indicação de perigo. */
export const IBAMA_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .-]*(?:\(\*\))?$/;
export function materialIntegrationIssues(material: any, label: string) {
  const issues: string[] = [];
  const volume = ["LITER", "CUBIC_METER"].includes(material.unit);
  if (
    (volume || material.density != null) &&
    !(
      typeof material.density === "number" &&
      Number.isFinite(material.density) &&
      material.density > 0
    )
  )
    issues.push(
      `${label}: informe densidade positiva para a preparação em volume ou corrija o valor preenchido. Confira a unidade de densidade exigida pelo SINIR.`,
    );
  const fields = [
    material.unNumber,
    material.riskClass,
    material.shippingName,
    material.packingGroup,
  ];
  if (
    (/\(\*\)$/.test(material.ibamaCode || "") ||
      fields.some((v) => typeof v === "string" && v.trim())) &&
    fields.some((v) => typeof v !== "string" || !v.trim())
  )
    issues.push(
      `${label}: complete número ONU, classe de risco, nome de embarque e grupo de embalagem para a conferência do resíduo perigoso.`,
    );
  return issues;
}
