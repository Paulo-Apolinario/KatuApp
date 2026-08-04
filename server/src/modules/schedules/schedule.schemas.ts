import { z } from "zod";

/*
 * ============================================================
 * ENUMS E CONSTANTES
 * ============================================================
 */

export const scheduleWasteUnitSchema = z.enum(
  ["KG", "TON", "LITER", "UNIT", "CUBIC_METER"],
  {
    errorMap: () => ({
      message: "Unidade de medida do material solicitado inválida.",
    }),
  }
);

export const scheduleStatusSchema = z.enum(
  [
    "REQUESTED",
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ],
  {
    errorMap: () => ({
      message: "Status do agendamento inválido.",
    }),
  }
);

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

const optionalTrimmedString = (maxLength = 255) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();

      return normalized === "" ? undefined : normalized;
    },
    z
      .string({
        invalid_type_error: "O campo deve ser um texto.",
      })
      .max(
        maxLength,
        `O campo deve possuir no máximo ${maxLength} caracteres.`
      )
      .optional()
  );

const requiredTrimmedString = (
  fieldName: string,
  minLength = 1,
  maxLength = 255
) =>
  z
    .string({
      required_error: `${fieldName} é obrigatório.`,
      invalid_type_error: `${fieldName} deve ser um texto.`,
    })
    .trim()
    .min(minLength, `${fieldName} é obrigatório.`)
    .max(
      maxLength,
      `${fieldName} deve possuir no máximo ${maxLength} caracteres.`
    );

const optionalPositiveNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().replace(",", ".");

      if (!normalized) {
        return undefined;
      }

      return Number(normalized);
    }

    return value;
  },
  z
    .number({
      invalid_type_error:
        "A quantidade estimada deve ser um valor numérico válido.",
    })
    .finite("A quantidade estimada deve ser um valor numérico válido.")
    .positive("A quantidade estimada deve ser maior que zero.")
    .optional()
);

const optionalWasteUnit = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (typeof value === "string") {
      return value.trim().toUpperCase();
    }

    return value;
  },
  scheduleWasteUnitSchema.optional()
);

const optionalIsoDate = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  },
  z
    .string({
      invalid_type_error: "A data deve estar em formato ISO válido.",
    })
    .datetime({
      message: "A data deve estar em formato ISO válido.",
      offset: true,
    })
    .optional()
);

/*
 * ============================================================
 * MATERIAL PROPOSTO
 * ============================================================
 *
 * Este objeto é usado quando o gerador informa um resíduo que ainda
 * não existe no catálogo oficial da cooperativa.
 *
 * O agendamento apenas registra a previsão.
 * O item não entra automaticamente no catálogo e não gera lote.
 *
 * A cooperativa poderá avaliar posteriormente a sugestão.
 */

export const proposedScheduleMaterialSchema = z.object({
  name: requiredTrimmedString("O nome do material proposto", 2, 150),

  category: optionalTrimmedString(100),

  subcategory: optionalTrimmedString(100),

  unit: optionalWasteUnit.transform((unit) => unit ?? "KG"),
});

/*
 * ============================================================
 * MATERIAL SOLICITADO
 * ============================================================
 *
 * Durante a solicitação, o gerador informa apenas o que pretende
 * entregar e, opcionalmente, uma quantidade estimada.
 *
 * Esse registro:
 * - não representa a coleta efetiva;
 * - não cria CollectionMaterial;
 * - não cria CollectionWasteEntry;
 * - não cria WasteStockLot;
 * - não finaliza o fluxo da cooperativa.
 */

export const structuredRequestedMaterialSchema = z
  .object({
    /*
     * Material já existente no catálogo da cooperativa.
     */
    wasteTypeId: optionalTrimmedString(100),

    /*
     * Material ainda inexistente no catálogo.
     */
    proposedMaterial: proposedScheduleMaterialSchema.optional(),

    /*
     * Quantidade apenas estimada pelo gerador.
     */
    estimatedQuantity: optionalPositiveNumber,

    /*
     * Alias temporário para compatibilidade com telas antigas.
     */
    quantity: optionalPositiveNumber,

    /*
     * Unidade aceita para itens do catálogo.
     * Para materiais propostos, a unidade também existe dentro
     * de proposedMaterial.
     */
    unit: optionalWasteUnit,

    /*
     * Compatibilidade temporária com payloads antigos.
     */
    name: optionalTrimmedString(150),
    type: optionalTrimmedString(150),
    category: optionalTrimmedString(100),
    subcategory: optionalTrimmedString(100),
  })
  .superRefine((material, context) => {
    const hasWasteTypeId = Boolean(material.wasteTypeId);
    const hasProposedMaterial = Boolean(material.proposedMaterial);
    const legacyName = material.name ?? material.type;

    const hasLegacyMaterial =
      typeof legacyName === "string" && legacyName.trim().length > 0;

    if (!hasWasteTypeId && !hasProposedMaterial && !hasLegacyMaterial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wasteTypeId"],
        message:
          "Selecione um material do catálogo ou informe um novo material.",
      });
    }

    if (hasWasteTypeId && hasProposedMaterial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedMaterial"],
        message:
          "Informe apenas um material do catálogo ou um novo material, nunca os dois ao mesmo tempo.",
      });
    }

    if (hasWasteTypeId && hasLegacyMaterial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message:
          "Quando wasteTypeId for informado, não envie também um material legado.",
      });
    }

    if (hasProposedMaterial && hasLegacyMaterial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message:
          "Quando proposedMaterial for informado, não envie também um material legado.",
      });
    }

    if (
      material.proposedMaterial &&
      material.unit &&
      material.proposedMaterial.unit !== material.unit
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unit"],
        message:
          "A unidade do material deve ser igual à unidade informada no material proposto.",
      });
    }
  })
  .transform((material) => {
    const estimatedQuantity =
      material.estimatedQuantity ?? material.quantity;

    if (material.wasteTypeId) {
      return {
        wasteTypeId: material.wasteTypeId,
        proposedMaterial: undefined,
        estimatedQuantity,
        unit: material.unit ?? "KG",
      };
    }

    if (material.proposedMaterial) {
      return {
        wasteTypeId: undefined,
        proposedMaterial: {
          name: material.proposedMaterial.name,
          category: material.proposedMaterial.category,
          subcategory: material.proposedMaterial.subcategory,
          unit: material.proposedMaterial.unit,
        },
        estimatedQuantity,
        unit: material.proposedMaterial.unit,
      };
    }

    const legacyName = material.name ?? material.type;

    return {
      wasteTypeId: undefined,
      proposedMaterial: {
        name: legacyName as string,
        category: material.category,
        subcategory: material.subcategory,
        unit: material.unit ?? "KG",
      },
      estimatedQuantity,
      unit: material.unit ?? "KG",
    };
  });

/*
 * Formato legado ainda aceito temporariamente:
 *
 * ["PAPEL", "METAL", "OUTRO"]
 *
 * Cada string será tratada como uma sugestão de material e não como
 * item oficial do catálogo.
 */
export const legacyRequestedMaterialSchema = requiredTrimmedString(
  "O material solicitado",
  1,
  150
).transform((name) => ({
  wasteTypeId: undefined,
  proposedMaterial: {
    name,
    category: undefined,
    subcategory: undefined,
    unit: "KG" as const,
  },
  estimatedQuantity: undefined,
  unit: "KG" as const,
}));

export const requestedMaterialSchema = z.union([
  legacyRequestedMaterialSchema,
  structuredRequestedMaterialSchema,
]);

export const requestedMaterialsSchema = z
  .array(requestedMaterialSchema, {
    required_error: "Informe ao menos um tipo de resíduo.",
    invalid_type_error:
      "A lista de materiais solicitados deve ser um array.",
  })
  .min(1, "Informe ao menos um tipo de resíduo.")
  .max(
    100,
    "Um agendamento pode possuir no máximo 100 materiais solicitados."
  )
  .superRefine((materials, context) => {
    const keys = new Set<string>();

    materials.forEach((material, index) => {
      const key = material.wasteTypeId
        ? `catalog:${material.wasteTypeId}:${material.unit}`
        : `proposal:${String(material.proposedMaterial?.name ?? "")
            .trim()
            .toLocaleLowerCase("pt-BR")}:${material.unit}`;

      if (keys.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message:
            "O mesmo material foi adicionado mais de uma vez com a mesma unidade.",
        });

        return;
      }

      keys.add(key);
    });
  });

/*
 * ============================================================
 * CRIAÇÃO DO AGENDAMENTO
 * ============================================================
 *
 * Fluxo:
 *
 * Gerador cria solicitação
 *   -> Schedule REQUESTED
 *   -> ScheduleRequestedMaterial[]
 *
 * Cooperativa recebe e delega
 *   -> Collection PENDING
 *
 * Catador realiza e conclui a coleta
 *   -> CollectionMaterial[]
 *   -> CollectionWasteEntry[]
 *
 * Cooperativa recebe fisicamente, confere, faz triagem e destina
 *   -> CollectionWasteDestination[]
 *   -> WasteStockLot apenas quando a destinação for STOCK
 */

export const createScheduleSchema = z
  .object({
    /*
     * Obrigatório apenas quando a cooperativa cria a solicitação
     * em nome de um gerador.
     */
    generatorId: optionalTrimmedString(100),

    /*
     * Mantido para PF e clientes antigos.
     * Geradores autenticados têm a cooperativa resolvida no service.
     */
    cooperativeId: optionalTrimmedString(100),

    preferredDate: optionalIsoDate,

    scheduledDate: optionalIsoDate,

    requestedMaterials: requestedMaterialsSchema,

    notes: optionalTrimmedString(2000),
  })
  .superRefine((data, context) => {
    if (
      data.preferredDate &&
      data.scheduledDate &&
      new Date(data.scheduledDate).getTime() <
        new Date(data.preferredDate).getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledDate"],
        message:
          "A data agendada não pode ser anterior à data preferencial.",
      });
    }
  });

/*
 * ============================================================
 * PARÂMETROS E STATUS
 * ============================================================
 */

export const scheduleIdParamsSchema = z.object({
  id: requiredTrimmedString("O ID do agendamento", 1, 100),
});

/**
 * Atualização manual permitida pelo módulo de agendamentos.
 *
 * SCHEDULED:
 * - confirma/prepara a solicitação;
 * - pode ocorrer antes da criação da Collection.
 *
 * CANCELLED:
 * - cancela somente solicitações que ainda não possuem fluxo
 *   operacional de coleta em andamento.
 *
 * IN_PROGRESS e COMPLETED permanecem no enum ScheduleStatus porque
 * são atualizados internamente pelo módulo Collection:
 *
 * - Collection IN_PROGRESS -> Schedule IN_PROGRESS;
 * - Collection COMPLETED   -> Schedule COMPLETED.
 */
export const updateScheduleStatusSchema = z.object({
  status: z.enum(
    ["SCHEDULED", "CANCELLED"],
    {
      errorMap: () => ({
        message:
          "A atualização manual do agendamento aceita apenas SCHEDULED ou CANCELLED.",
      }),
    }
  ),
});

/*
 * ============================================================
 * TIPOS
 * ============================================================
 */

export type ScheduleWasteUnit = z.infer<
  typeof scheduleWasteUnitSchema
>;

export type ProposedScheduleMaterial = z.infer<
  typeof proposedScheduleMaterialSchema
>;

export type RequestedScheduleMaterial = z.infer<
  typeof requestedMaterialSchema
>;

export type CreateScheduleInput = z.infer<
  typeof createScheduleSchema
>;

export type ScheduleIdParams = z.infer<
  typeof scheduleIdParamsSchema
>;

export type UpdateScheduleStatusInput = z.infer<
  typeof updateScheduleStatusSchema
>;
