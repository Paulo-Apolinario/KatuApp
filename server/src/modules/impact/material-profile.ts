import { z } from "zod";
export const materialCodes = [
  "UNKNOWN",
  "ALUMINUM",
  "COPPER",
  "STEEL",
  "PET",
  "PP",
  "HDPE",
  "LDPE",
  "PVC",
  "PS",
  "PAPER",
  "CARDBOARD",
  "GLASS",
  "COOKING_OIL",
  "COCONUT",
  "ORGANIC",
  "ELECTRONICS",
  "MIXED",
  "REJECT",
] as const;
const text = (max = 500) => z.string().trim().max(max).default("");
export const materialProfileSchema = z
  .object({
    materialCode: z.enum(materialCodes).default("UNKNOWN"),
    presentation: text(120),
    color: text(80),
    composition: text(1000),
    identification: z
      .enum(["UNKNOWN", "DECLARED", "VERIFIED"])
      .default("UNKNOWN"),
    identificationEvidence: text(1000),
    sourceProcess: text(),
    contaminants: text(1000),
    standardEdition: z.enum(["", "2004", "2024"]).default(""),
    hazardClass: z
      .enum(["", "CLASS_I", "CLASS_II_A", "CLASS_II_B", "CLASS_1", "CLASS_2"])
      .default(""),
    classificationStatus: z.enum(["PENDING", "DOCUMENTED"]).default("PENDING"),
    classificationDocument: text(1000),
    responsible: text(200),
    codeSystem: text(120),
    codeVersion: text(80),
    technicalCode: text(100),
  })
  .strict()
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (v.identification !== "UNKNOWN" && v.materialCode === "UNKNOWN")
      fail(
        "Selecione o material ou mantenha a identificação como desconhecida.",
      );
    if (
      v.identification === "VERIFIED" &&
      (!v.identificationEvidence || !v.responsible)
    )
      fail("Identificação conferida exige evidência e responsável.");
    if (
      v.classificationStatus === "DOCUMENTED" &&
      (!v.hazardClass ||
        !v.standardEdition ||
        !v.classificationDocument ||
        !v.responsible)
    )
      fail(
        "Classificação documentada exige edição, classe, documento e responsável.",
      );
    if (
      v.hazardClass &&
      !(
        v.standardEdition === "2024"
          ? ["CLASS_1", "CLASS_2"]
          : v.standardEdition === "2004"
            ? ["CLASS_I", "CLASS_II_A", "CLASS_II_B"]
            : []
      ).includes(v.hazardClass)
    )
      fail(
        "A classe deve corresponder à edição da norma. Não há conversão automática.",
      );
    if (v.technicalCode && (!v.codeSystem || !v.codeVersion))
      fail("Informe a lista de origem e a versão do código técnico.");
  });
export function catalogDeclaration(profile: any, capturedAt = new Date()) {
  if (!profile) return undefined;
  return {
    source: "CATALOG_DECLARATION",
    capturedAt: capturedAt.toISOString(),
    declared: profile,
  };
}
