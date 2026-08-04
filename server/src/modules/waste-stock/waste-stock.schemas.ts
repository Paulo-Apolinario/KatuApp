import { z } from "zod";

/**
 * Status do tipo de resíduo cadastrado pela cooperativa.
 */
export const wasteStockStatusSchema = z.enum(
  ["ACTIVE", "INACTIVE"],
  {
    errorMap: () => ({
      message: "Status do tipo de resíduo inválido.",
    }),
  }
);

/**
 * Status operacional de um lote.
 */
export const wasteLotStatusSchema = z.enum(
  ["AVAILABLE", "RESERVED", "SOLD", "DISCARDED"],
  {
    errorMap: () => ({
      message: "Status do lote inválido.",
    }),
  }
);

/**
 * Etapa de processamento do material.
 */
export const wasteProcessingStageSchema = z.enum(
  [
    "TRIADO",
    "TRITURADO",
    "PRENSADO",
    "ENFARDADO",
    "ARMAZENADO",
    "DESTINADO",
  ],
  {
    errorMap: () => ({
      message: "Etapa de processamento inválida.",
    }),
  }
);

/**
 * Unidade utilizada no catálogo e nos lotes.
 */
export const wasteUnitSchema = z.enum(
  ["KG", "TON", "LITER", "UNIT", "CUBIC_METER"],
  {
    errorMap: () => ({
      message: "Unidade de medida inválida.",
    }),
  }
);

/**
 * Classe do resíduo.
 */
export const wasteClassSchema = z.enum(
  ["CLASS_I", "CLASS_II_A", "CLASS_II_B", "NOT_INFORMED"],
  {
    errorMap: () => ({
      message: "Classe do resíduo inválida.",
    }),
  }
);

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
      .string()
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

const positiveNumber = z.preprocess(
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
      return Number(
        value
          .trim()
          .replace(",", ".")
      );
    }

    return value;
  },
  z
    .number({
      required_error: "A quantidade é obrigatória.",
      invalid_type_error: "Informe uma quantidade válida.",
    })
    .finite("Informe uma quantidade válida.")
    .positive("A quantidade deve ser maior que zero.")
);

/**
 * Normaliza enums opcionais enviados por JSON ou FormData.
 */
const optionalEnumValue = <T extends z.ZodTypeAny>(
  schema: T
) =>
  z.preprocess(
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
    schema.optional()
  );

/**
 * Cadastro do tipo de resíduo da cooperativa.
 *
 * Esta operação não exige lote.
 */
export const createWasteStockItemSchema = z.object({
  name: requiredTrimmedString(
    "O nome do resíduo",
    2,
    150
  ),

  category: requiredTrimmedString(
    "A categoria",
    2,
    100
  ),

  subcategory: optionalTrimmedString(100),

  unit: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "KG";
      }

      if (typeof value === "string") {
        return value
          .trim()
          .toUpperCase();
      }

      return value;
    },
    wasteUnitSchema
  ),

  ncm: optionalTrimmedString(20),

  internalCode: optionalTrimmedString(50),

  wasteClass: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "NOT_INFORMED";
      }

      if (typeof value === "string") {
        return value
          .trim()
          .toUpperCase();
      }

      return value;
    },
    wasteClassSchema
  ),

  description: optionalTrimmedString(1500),

  status: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "ACTIVE";
      }

      if (typeof value === "string") {
        return value
          .trim()
          .toUpperCase();
      }

      return value;
    },
    wasteStockStatusSchema
  ),
});

/**
 * Atualização do tipo de resíduo.
 *
 * Todos os campos são opcionais, mas pelo menos um precisa ser informado.
 */
export const updateWasteStockItemSchema =
  createWasteStockItemSchema
    .partial()
    .refine(
      (data) =>
        Object.values(data).some(
          (value) => value !== undefined
        ),
      {
        message:
          "Informe pelo menos um campo para atualizar o tipo de resíduo.",
      }
    );

/**
 * Cadastro de lote para um tipo já existente.
 */
export const createWasteStockLotSchema = z.object({
  lotCode: requiredTrimmedString(
    "O código do lote",
    1,
    100
  ),

  quantity: positiveNumber,

  unit: optionalEnumValue(
    wasteUnitSchema
  ),

  storageLocation:
    optionalTrimmedString(255),

  processingStage: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "TRIADO";
      }

      if (typeof value === "string") {
        return value
          .trim()
          .toUpperCase();
      }

      return value;
    },
    wasteProcessingStageSchema
  ),

  origin: optionalTrimmedString(255),

  notes: optionalTrimmedString(1500),

  status: z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return "AVAILABLE";
      }

      if (typeof value === "string") {
        return value
          .trim()
          .toUpperCase();
      }

      return value;
    },
    wasteLotStatusSchema
  ),
});

/**
 * Atualização de lote.
 */
export const updateWasteStockLotSchema = z
  .object({
    lotCode: optionalTrimmedString(100),

    quantity: optionalNumber.refine(
      (value) =>
        value === undefined ||
        value > 0,
      {
        message:
          "A quantidade deve ser maior que zero.",
      }
    ),

    unit: optionalEnumValue(
      wasteUnitSchema
    ),

    storageLocation:
      optionalTrimmedString(255),

    processingStage:
      optionalEnumValue(
        wasteProcessingStageSchema
      ),

    origin: optionalTrimmedString(255),

    notes: optionalTrimmedString(1500),

    status: optionalEnumValue(
      wasteLotStatusSchema
    ),
  })
  .refine(
    (data) =>
      Object.values(data).some(
        (value) => value !== undefined
      ),
    {
      message:
        "Informe pelo menos um campo para atualizar o lote.",
    }
  );

/**
 * Compatibilidade temporária com o formato antigo:
 *
 * {
 *   item: {...},
 *   lot: {...}
 * }
 *
 * Este schema será removido quando o frontend antigo deixar de ser usado.
 */
export const createLegacyWasteStockSchema = z.object({
  item: createWasteStockItemSchema,

  lot: z.object({
    lotCode: requiredTrimmedString(
      "O código do lote",
      1,
      100
    ),

    quantityKg: positiveNumber.optional(),

    quantity: positiveNumber.optional(),

    unit: optionalEnumValue(
      wasteUnitSchema
    ),

    storageLocation:
      optionalTrimmedString(255),

    processingStage: z.preprocess(
      (value) => {
        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return "TRIADO";
        }

        if (typeof value === "string") {
          return value
            .trim()
            .toUpperCase();
        }

        return value;
      },
      wasteProcessingStageSchema
    ),

    origin: optionalTrimmedString(255),

    notes: optionalTrimmedString(1500),

    status: z.preprocess(
      (value) => {
        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return "AVAILABLE";
        }

        if (typeof value === "string") {
          return value
            .trim()
            .toUpperCase();
        }

        return value;
      },
      wasteLotStatusSchema
    ),
  })
    .refine(
      (lot) =>
        Number(lot.quantity || 0) > 0 ||
        Number(lot.quantityKg || 0) > 0,
      {
        message:
          "Informe uma quantidade válida para o lote.",
        path: ["quantity"],
      }
    ),
});

/**
 * Parâmetro padrão contendo o ID do tipo de resíduo.
 */
export const wasteStockItemIdParamsSchema =
  z.object({
    id: z
      .string({
        required_error:
          "O ID do tipo de resíduo é obrigatório.",
      })
      .trim()
      .min(
        1,
        "ID do tipo de resíduo inválido."
      ),
  });

/**
 * Parâmetro padrão contendo o ID do lote.
 */
export const wasteStockLotIdParamsSchema =
  z.object({
    lotId: z
      .string({
        required_error:
          "O ID do lote é obrigatório.",
      })
      .trim()
      .min(1, "ID do lote inválido."),
  });

export type CreateWasteStockItemInput =
  z.infer<
    typeof createWasteStockItemSchema
  >;

export type UpdateWasteStockItemInput =
  z.infer<
    typeof updateWasteStockItemSchema
  >;

export type CreateWasteStockLotInput =
  z.infer<
    typeof createWasteStockLotSchema
  >;

export type UpdateWasteStockLotInput =
  z.infer<
    typeof updateWasteStockLotSchema
  >;

export type CreateLegacyWasteStockInput =
  z.infer<
    typeof createLegacyWasteStockSchema
  >;

export type WasteStockItemIdParams =
  z.infer<
    typeof wasteStockItemIdParamsSchema
  >;

export type WasteStockLotIdParams =
  z.infer<
    typeof wasteStockLotIdParamsSchema
  >;