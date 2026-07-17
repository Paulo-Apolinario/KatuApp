import { z } from "zod";

/*
 * ============================================================
 * ENUMS
 * ============================================================
 */

/**
 * Status aceitos para a coleta.
 *
 * Os valores precisam permanecer iguais ao enum CollectionStatus
 * existente no schema.prisma.
 */
export const collectionStatusSchema = z.enum(
  ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  {
    errorMap: () => ({
      message: "Status da coleta inválido.",
    }),
  }
);

/**
 * Unidades aceitas para materiais coletados.
 *
 * Os valores precisam permanecer iguais ao enum WasteUnit
 * existente no schema.prisma.
 */
export const collectionWasteUnitSchema = z.enum(
  ["KG", "TON", "LITER", "UNIT", "CUBIC_METER"],
  {
    errorMap: () => ({
      message: "Unidade de medida do material inválida.",
    }),
  }
);

/*
 * ============================================================
 * FUNÇÕES AUXILIARES DE NORMALIZAÇÃO
 * ============================================================
 */

/**
 * Converte campos de texto vazios em undefined.
 *
 * Isso permite receber payloads vindos tanto de JSON quanto de
 * formulários, nos quais campos vazios costumam ser enviados como "".
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

/**
 * Campo de texto obrigatório e normalizado.
 */
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

/**
 * Número opcional.
 *
 * Aceita:
 * - number;
 * - string numérica;
 * - vírgula decimal;
 * - undefined;
 * - null;
 * - string vazia.
 */
const optionalNumber = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return undefined;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value
        .trim()
        .replace(",", ".");

      if (!normalized) {
        return undefined;
      }

      return Number(normalized);
    }

    return value;
  },
  z
    .number({
      invalid_type_error: "Informe um valor numérico válido.",
    })
    .finite("Informe um valor numérico válido.")
    .optional()
);

/**
 * Número opcional e não negativo.
 *
 * Utilizado principalmente para compatibilidade com o payload antigo.
 */
const optionalNonNegativeNumber = optionalNumber.refine(
  (value) =>
    value === undefined ||
    value >= 0,
  {
    message: "A quantidade não pode ser negativa.",
  }
);

/**
 * Número opcional, porém maior que zero quando informado.
 */
const optionalPositiveNumber = optionalNumber.refine(
  (value) =>
    value === undefined ||
    value > 0,
  {
    message: "A quantidade deve ser maior que zero.",
  }
);

/**
 * Normaliza unidade opcional.
 */
const optionalWasteUnit = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return undefined;
    }

    if (typeof value === "string") {
      return value
        .trim()
        .toUpperCase();
    }

    return value;
  },
  collectionWasteUnitSchema.optional()
);

/**
 * Normaliza datas ISO opcionais.
 *
 * O backend receberá a data como string e fará a conversão para Date
 * dentro do service.
 */
const optionalIsoDate = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return undefined;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return value;
  },
  z
    .string({
      invalid_type_error:
        "A data deve estar em formato ISO válido.",
    })
    .datetime({
      message:
        "A data deve estar em formato ISO válido.",
      offset: true,
    })
    .optional()
);

/*
 * ============================================================
 * MATERIAL DA COLETA
 * ============================================================
 */

/**
 * Formato de material aceito pelo backend.
 *
 * Compatibilidade antiga:
 *
 * {
 *   type: "Plástico",
 *   quantityKg: 10
 * }
 *
 * Formato novo:
 *
 * {
 *   wasteTypeId: "id-do-catalogo",
 *   name: "Plástico PET",
 *   category: "Plásticos",
 *   subcategory: "PET",
 *   quantity: 10,
 *   unit: "KG"
 * }
 */
export const collectionMaterialSchema = z
  .object({
    /**
     * Referência opcional ao catálogo WasteStockItem.
     */
    wasteTypeId: optionalTrimmedString(100),

    /**
     * Campo legado utilizado pelo App e por telas antigas.
     */
    type: optionalTrimmedString(150),

    /**
     * Nome utilizado pelo novo formato.
     */
    name: optionalTrimmedString(150),

    /**
     * Snapshots opcionais.
     *
     * Quando wasteTypeId for informado, o service poderá preencher
     * esses valores a partir do catálogo.
     */
    category: optionalTrimmedString(100),
    subcategory: optionalTrimmedString(100),

    /**
     * Quantidade genérica para o novo formato.
     */
    quantity: optionalPositiveNumber,

    /**
     * Campo legado em quilogramas.
     */
    quantityKg: optionalNonNegativeNumber,

    /**
     * Unidade do novo formato.
     *
     * Quando omitida:
     * - quantityKg implica KG;
     * - quantity utiliza KG como fallback temporário.
     */
    unit: optionalWasteUnit,
  })
  .superRefine((material, context) => {
    const hasWasteTypeId =
      typeof material.wasteTypeId === "string" &&
      material.wasteTypeId.length > 0;

    const hasType =
      typeof material.type === "string" &&
      material.type.length > 0;

    const hasName =
      typeof material.name === "string" &&
      material.name.length > 0;

    if (!hasWasteTypeId && !hasType && !hasName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message:
          "Informe o tipo, o nome ou o ID do resíduo coletado.",
      });
    }

    const hasQuantity =
      typeof material.quantity === "number";

    const hasQuantityKg =
      typeof material.quantityKg === "number";

    if (!hasQuantity && !hasQuantityKg) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message:
          "Informe a quantidade do material coletado.",
      });

      return;
    }

    if (
      hasQuantity &&
      Number(material.quantity) <= 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message:
          "A quantidade do material deve ser maior que zero.",
      });
    }

    if (
      !hasQuantity &&
      hasQuantityKg &&
      Number(material.quantityKg) <= 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityKg"],
        message:
          "A quantidade do material deve ser maior que zero.",
      });
    }

    if (
      hasQuantity &&
      hasQuantityKg &&
      Number(material.quantity) !==
        Number(material.quantityKg) &&
      (!material.unit || material.unit === "KG")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message:
          "quantity e quantityKg não podem possuir valores diferentes quando a unidade for KG.",
      });
    }

    if (
      material.quantityKg !== undefined &&
      material.unit !== undefined &&
      material.unit !== "KG" &&
      material.quantity === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unit"],
        message:
          "quantityKg só pode ser utilizado sozinho quando a unidade for KG.",
      });
    }
  });

/**
 * Array de materiais.
 *
 * Limite preventivo para evitar payloads excessivamente grandes.
 */
export const collectionMaterialsSchema = z
  .array(collectionMaterialSchema, {
    invalid_type_error:
      "A lista de materiais deve ser um array.",
  })
  .max(
    200,
    "Uma coleta pode possuir no máximo 200 materiais."
  );

/*
 * ============================================================
 * CRIAÇÃO DA COLETA
 * ============================================================
 */

/**
 * Criação ou delegação inicial da coleta.
 *
 * Nesta etapa, materiais ainda são opcionais porque a cooperativa pode
 * criar a coleta antes da execução em campo.
 */
export const createCollectionSchema = z
  .object({
    scheduleId: requiredTrimmedString(
      "O agendamento",
      1,
      100
    ),

    collectorId: requiredTrimmedString(
      "O catador",
      1,
      100
    ),

    driverId: optionalTrimmedString(100),

    vehicleId: optionalTrimmedString(100),

    routeId: optionalTrimmedString(100),

    collectedAt: optionalIsoDate,

    totalWeightKg: optionalNonNegativeNumber,

    materials: collectionMaterialsSchema.optional(),

    notes: optionalTrimmedString(2000),
  })
  .superRefine((data, context) => {
    if (
      data.materials &&
      data.materials.length === 0 &&
      Number(data.totalWeightKg || 0) > 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["materials"],
        message:
          "Informe os materiais correspondentes ao peso total da coleta.",
      });
    }
  });

/*
 * ============================================================
 * ATUALIZAÇÃO DE STATUS
 * ============================================================
 */

/**
 * Atualização do status e dos dados operacionais da coleta.
 *
 * Ao concluir, o service verificará:
 * - presença de materiais;
 * - quantidade positiva;
 * - catálogo;
 * - duplicidades;
 * - criação dos registros normalizados.
 */
export const updateCollectionStatusSchema = z
  .object({
    status: collectionStatusSchema,

    collectedAt: optionalIsoDate,

    totalWeightKg: optionalNonNegativeNumber,

    materials: collectionMaterialsSchema.optional(),

    notes: optionalTrimmedString(2000),
  })
  .superRefine((data, context) => {
    if (
      data.status === "COMPLETED" &&
      data.materials !== undefined &&
      data.materials.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["materials"],
        message:
          "Informe pelo menos um material para concluir a coleta.",
      });
    }

    if (
      data.status === "COMPLETED" &&
      data.totalWeightKg !== undefined &&
      data.totalWeightKg <= 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalWeightKg"],
        message:
          "O peso total precisa ser maior que zero para concluir a coleta.",
      });
    }
  });

/*
 * ============================================================
 * PARÂMETROS
 * ============================================================
 */

/**
 * Parâmetro padrão contendo o ID da coleta.
 */
export const collectionIdParamsSchema = z.object({
  id: requiredTrimmedString(
    "O ID da coleta",
    1,
    100
  ),
});

/*
 * ============================================================
 * FILTROS FUTUROS
 * ============================================================
 */

/**
 * Filtros opcionais para a listagem de coletas.
 *
 * O endpoint atual ainda pode ignorar alguns desses filtros, mas o schema
 * já prepara o módulo para paginação e consultas operacionais.
 */
export const collectionListQuerySchema = z.object({
  status: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return undefined;
      }

      if (typeof value === "string") {
        return value
          .trim()
          .toUpperCase();
      }

      return value;
    },
    collectionStatusSchema.optional()
  ),

  generatorId: optionalTrimmedString(100),

  collectorId: optionalTrimmedString(100),

  driverId: optionalTrimmedString(100),

  vehicleId: optionalTrimmedString(100),

  routeId: optionalTrimmedString(100),

  dateFrom: optionalIsoDate,

  dateTo: optionalIsoDate,

  page: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return 1;
      }

      return Number(value);
    },
    z
      .number({
        invalid_type_error:
          "A página deve ser um número.",
      })
      .int("A página deve ser um número inteiro.")
      .positive("A página deve ser maior que zero.")
      .default(1)
  ),

  limit: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return 50;
      }

      return Number(value);
    },
    z
      .number({
        invalid_type_error:
          "O limite deve ser um número.",
      })
      .int("O limite deve ser um número inteiro.")
      .min(
        1,
        "O limite deve ser maior que zero."
      )
      .max(
        200,
        "O limite máximo é de 200 registros."
      )
      .default(50)
  ),
});

/*
 * ============================================================
 * TIPOS TYPESCRIPT
 * ============================================================
 */

export type CollectionStatusInput = z.infer<
  typeof collectionStatusSchema
>;

export type CollectionWasteUnitInput = z.infer<
  typeof collectionWasteUnitSchema
>;

export type CollectionMaterialSchemaInput = z.infer<
  typeof collectionMaterialSchema
>;

export type CreateCollectionInput = z.infer<
  typeof createCollectionSchema
>;

export type UpdateCollectionStatusInput = z.infer<
  typeof updateCollectionStatusSchema
>;

export type CollectionIdParams = z.infer<
  typeof collectionIdParamsSchema
>;

export type CollectionListQuery = z.infer<
  typeof collectionListQuerySchema
>;