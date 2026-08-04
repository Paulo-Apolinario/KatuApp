import { z } from "zod";

/*
 * ============================================================
 * ENUMS
 * ============================================================
 */

export const collectionStatusSchema = z.enum(
  [
    "PENDING",
    "IN_PROGRESS",
    "COLLECTED",
    "RECEIVED",
    "SORTING",
    "COMPLETED",
    "CANCELLED",
  ],
  {
    errorMap: () => ({
      message: "Status da coleta inválido.",
    }),
  }
);

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

      return normalized
        ? Number(normalized)
        : undefined;
    }

    return value;
  },
  z
    .number({
      invalid_type_error:
        "Informe um valor numérico válido.",
    })
    .finite(
      "Informe um valor numérico válido."
    )
    .optional()
);

const optionalPositiveNumber =
  optionalNumber.refine(
    (value) =>
      value === undefined ||
      value > 0,
    {
      message:
        "A quantidade deve ser maior que zero.",
    }
  );

const optionalWasteUnit =
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
    collectionWasteUnitSchema.optional()
  );

const optionalIsoDate =
  z.preprocess(
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
 * MATERIAL PROPOSTO
 * ============================================================
 */

export const proposedCollectionMaterialSchema =
  z.object({
    name: requiredTrimmedString(
      "O nome do material",
      2,
      150
    ),

    category:
      optionalTrimmedString(100),

    subcategory:
      optionalTrimmedString(100),

    unit:
      optionalWasteUnit.transform(
        (unit) => unit ?? "KG"
      ),
  });

/*
 * ============================================================
 * MATERIAL EFETIVAMENTE COLETADO
 * ============================================================
 *
 * Mantém compatibilidade com:
 *
 * {
 *   type: "Plástico",
 *   quantityKg: 10
 * }
 *
 * E aceita o contrato novo:
 *
 * {
 *   wasteTypeId: "...",
 *   quantity: 10,
 *   unit: "KG"
 * }
 *
 * ou:
 *
 * {
 *   proposedMaterial: {
 *     name: "Material não catalogado",
 *     unit: "KG"
 *   },
 *   quantity: 10
 * }
 */

export const collectionMaterialSchema =
  z
    .object({
      wasteTypeId:
        optionalTrimmedString(100),

      proposedMaterial:
        proposedCollectionMaterialSchema.optional(),

      type:
        optionalTrimmedString(150),

      name:
        optionalTrimmedString(150),

      category:
        optionalTrimmedString(100),

      subcategory:
        optionalTrimmedString(100),

      quantity:
        optionalPositiveNumber,

      quantityKg:
        optionalPositiveNumber,

      unit:
        optionalWasteUnit,

      notes:
        optionalTrimmedString(1000),
    })
    .superRefine(
      (material, context) => {
        const legacyName =
          material.name ??
          material.type;

        const hasWasteTypeId =
          Boolean(
            material.wasteTypeId
          );

        const hasProposedMaterial =
          Boolean(
            material.proposedMaterial
          );

        const hasLegacyName =
          Boolean(legacyName);

        if (
          !hasWasteTypeId &&
          !hasProposedMaterial &&
          !hasLegacyName
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ["wasteTypeId"],

            message:
              "Selecione um material do catálogo ou informe um novo material.",
          });
        }

        if (
          Number(hasWasteTypeId) +
            Number(
              hasProposedMaterial
            ) +
            Number(hasLegacyName) >
          1
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ["proposedMaterial"],

            message:
              "Informe apenas uma origem para o material: catálogo, proposta ou formato legado.",
          });
        }

        if (
          material.quantity ===
            undefined &&
          material.quantityKg ===
            undefined
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ["quantity"],

            message:
              "Informe a quantidade do material coletado.",
          });
        }

        if (
          material.quantity !==
            undefined &&
          material.quantityKg !==
            undefined &&
          (
            material.unit ===
              undefined ||
            material.unit === "KG"
          ) &&
          material.quantity !==
            material.quantityKg
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ["quantity"],

            message:
              "quantity e quantityKg não podem possuir valores diferentes quando a unidade for KG.",
          });
        }

        if (
          material.proposedMaterial &&
          material.unit &&
          material.proposedMaterial
            .unit !==
            material.unit
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ["unit"],

            message:
              "A unidade deve ser igual à unidade informada no material proposto.",
          });
        }
      }
    )
    .transform((material) => {
      const quantity =
        material.quantity ??
        material.quantityKg ??
        0;

      if (material.wasteTypeId) {
        return {
          wasteTypeId:
            material.wasteTypeId,

          proposedMaterial:
            undefined,

          quantity,

          unit:
            material.unit ??
            "KG",

          notes:
            material.notes,
        };
      }

      if (
        material.proposedMaterial
      ) {
        return {
          wasteTypeId:
            undefined,

          proposedMaterial:
            material.proposedMaterial,

          quantity,

          unit:
            material
              .proposedMaterial
              .unit,

          notes:
            material.notes,
        };
      }

      return {
        wasteTypeId:
          undefined,

        proposedMaterial: {
          name:
            (
              material.name ??
              material.type
            ) as string,

          category:
            material.category,

          subcategory:
            material.subcategory,

          unit:
            material.unit ??
            "KG",
        },

        quantity,

        unit:
          material.unit ??
          "KG",

        notes:
          material.notes,
      };
    });

export const collectionMaterialsSchema =
  z
    .array(
      collectionMaterialSchema,
      {
        required_error:
          "Informe ao menos um material coletado.",

        invalid_type_error:
          "A lista de materiais deve ser um array.",
      }
    )
    .min(
      1,
      "Informe ao menos um material coletado."
    )
    .max(
      200,
      "Uma coleta pode possuir no máximo 200 materiais."
    )
    .superRefine(
      (materials, context) => {
        const keys =
          new Set<string>();

        materials.forEach(
          (
            material,
            index
          ) => {
            const key =
              material.wasteTypeId
                ? `catalog:${material.wasteTypeId}:${material.unit}`
                : `proposal:${String(
                    material
                      .proposedMaterial
                      ?.name ?? ""
                  )
                    .trim()
                    .toLocaleLowerCase(
                      "pt-BR"
                    )}:${material.unit}`;

            if (
              keys.has(key)
            ) {
              context.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path:
                  [index],

                message:
                  "O mesmo material foi informado mais de uma vez com a mesma unidade.",
              });
            }

            keys.add(key);
          }
        );
      }
    );

/*
 * ============================================================
 * CRIAÇÃO/DELEGAÇÃO
 * ============================================================
 */

export const createCollectionSchema =
  z.object({
    scheduleId:
      requiredTrimmedString(
        "O agendamento",
        1,
        100
      ),

    collectorId:
      requiredTrimmedString(
        "O catador",
        1,
        100
      ),

    driverId:
      optionalTrimmedString(100),

    vehicleId:
      optionalTrimmedString(100),

    routeId:
      optionalTrimmedString(100),

    notes:
      optionalTrimmedString(2000),
  });

/*
 * ============================================================
 * OPERAÇÕES DO CICLO
 * ============================================================
 */

export const startCollectionSchema =
  z.object({
    startedAt:
      optionalIsoDate,

    notes:
      optionalTrimmedString(2000),
  });

export const completeFieldCollectionSchema =
  z.object({
    collectedAt:
      optionalIsoDate,

    materials:
      collectionMaterialsSchema,

    totalWeightKg:
      optionalPositiveNumber,

    notes:
      optionalTrimmedString(2000),
  });

export const receiveCollectionSchema =
  z.object({
    receivedAt:
      optionalIsoDate,

    notes:
      optionalTrimmedString(2000),
  });

export const startSortingSchema =
  z.object({
    sortingStartedAt:
      optionalIsoDate,

    notes:
      optionalTrimmedString(2000),
  });

export const completeCollectionSchema =
  z.object({
    completedAt:
      optionalIsoDate,

    notes:
      optionalTrimmedString(2000),
  });

export const cancelCollectionSchema =
  z.object({
    cancelledAt:
      optionalIsoDate,

    cancellationReason:
      requiredTrimmedString(
        "O motivo do cancelamento",
        3,
        1000
      ),
  });

/*
 * ============================================================
 * ATUALIZAÇÃO LEGADA DE STATUS
 * ============================================================
 */

export const updateCollectionStatusSchema =
  z
    .object({
      status:
        collectionStatusSchema,

      collectedAt:
        optionalIsoDate,

      totalWeightKg:
        optionalPositiveNumber,

      materials:
        collectionMaterialsSchema.optional(),

      notes:
        optionalTrimmedString(2000),

      cancellationReason:
        optionalTrimmedString(1000),
    })
    .superRefine(
      (data, context) => {
        if (
          data.status ===
            "COLLECTED" &&
          (
            !data.materials ||
            data.materials.length ===
              0
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ["materials"],

            message:
              "Informe os materiais efetivamente coletados para avançar para COLLECTED.",
          });
        }

        if (
          data.status ===
            "CANCELLED" &&
          !data.cancellationReason
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              [
                "cancellationReason",
              ],

            message:
              "O motivo do cancelamento é obrigatório.",
          });
        }

        if (
          data.status !==
            "COLLECTED" &&
          (
            data.materials !==
              undefined ||
            data.collectedAt !==
              undefined ||
            data.totalWeightKg !==
              undefined
          )
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path:
              ["materials"],

            message:
              "Materiais, data e peso coletado pertencem somente à conclusão da etapa de campo.",
          });
        }
      }
    );

/*
 * ============================================================
 * PARÂMETROS E FILTROS
 * ============================================================
 */

export const collectionIdParamsSchema =
  z.object({
    id:
      requiredTrimmedString(
        "O ID da coleta",
        1,
        100
      ),
  });

export const collectionListQuerySchema =
  z.object({
    status:
      z.preprocess(
        (value) => {
          if (
            value === null ||
            value ===
              undefined ||
            value === ""
          ) {
            return undefined;
          }

          if (
            typeof value ===
            "string"
          ) {
            return value
              .trim()
              .toUpperCase();
          }

          return value;
        },
        collectionStatusSchema.optional()
      ),

    generatorId:
      optionalTrimmedString(100),

    collectorId:
      optionalTrimmedString(100),

    driverId:
      optionalTrimmedString(100),

    vehicleId:
      optionalTrimmedString(100),

    routeId:
      optionalTrimmedString(100),

    dateFrom:
      optionalIsoDate,

    dateTo:
      optionalIsoDate,

    page:
      z.preprocess(
        (value) => {
          if (
            value === null ||
            value ===
              undefined ||
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
          .int(
            "A página deve ser um número inteiro."
          )
          .positive(
            "A página deve ser maior que zero."
          )
          .default(1)
      ),

    limit:
      z.preprocess(
        (value) => {
          if (
            value === null ||
            value ===
              undefined ||
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
          .int(
            "O limite deve ser um número inteiro."
          )
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
 * TIPOS
 * ============================================================
 */

export type CollectionStatusInput =
  z.infer<
    typeof collectionStatusSchema
  >;

export type CollectionWasteUnitInput =
  z.infer<
    typeof collectionWasteUnitSchema
  >;

export type ProposedCollectionMaterialInput =
  z.infer<
    typeof proposedCollectionMaterialSchema
  >;

export type CollectionMaterialSchemaInput =
  z.infer<
    typeof collectionMaterialSchema
  >;

export type CreateCollectionInput =
  z.infer<
    typeof createCollectionSchema
  >;

export type StartCollectionInput =
  z.infer<
    typeof startCollectionSchema
  >;

export type CompleteFieldCollectionInput =
  z.infer<
    typeof completeFieldCollectionSchema
  >;

export type ReceiveCollectionInput =
  z.infer<
    typeof receiveCollectionSchema
  >;

export type StartSortingInput =
  z.infer<
    typeof startSortingSchema
  >;

export type CompleteCollectionInput =
  z.infer<
    typeof completeCollectionSchema
  >;

export type CancelCollectionInput =
  z.infer<
    typeof cancelCollectionSchema
  >;

export type UpdateCollectionStatusInput =
  z.infer<
    typeof updateCollectionStatusSchema
  >;

export type CollectionIdParams =
  z.infer<
    typeof collectionIdParamsSchema
  >;

export type CollectionListQuery =
  z.infer<
    typeof collectionListQuerySchema
  >;
