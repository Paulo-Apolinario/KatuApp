import {
  WasteDestinationType,
  WasteUnit,
} from "@prisma/client";

import { z } from "zod";

/*
 * ============================================================
 * ENUMS
 * ============================================================
 */

export const wasteDestinationTypeSchema =
  z.nativeEnum(WasteDestinationType, {
    errorMap: () => ({
      message:
        "Tipo de destinação inválido.",
    }),
  });

export const wasteDestinationUnitSchema =
  z.nativeEnum(WasteUnit, {
    errorMap: () => ({
      message:
        "Unidade de medida inválida.",
    }),
  });

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function requiredTrimmedString(
  fieldName: string,
  minLength = 1,
  maxLength = 255
) {
  return z
    .string({
      required_error:
        `${fieldName} é obrigatório.`,
      invalid_type_error:
        `${fieldName} deve ser um texto.`,
    })
    .trim()
    .min(
      minLength,
      `${fieldName} é obrigatório.`
    )
    .max(
      maxLength,
      `${fieldName} deve possuir no máximo ${maxLength} caracteres.`
    );
}

function optionalTrimmedString(
  fieldName: string,
  maxLength = 255
) {
  return z
    .string({
      invalid_type_error:
        `${fieldName} deve ser um texto.`,
    })
    .trim()
    .max(
      maxLength,
      `${fieldName} deve possuir no máximo ${maxLength} caracteres.`
    )
    .optional();
}

function nullableOptionalTrimmedString(
  fieldName: string,
  maxLength = 255
) {
  return z
    .string({
      invalid_type_error:
        `${fieldName} deve ser um texto.`,
    })
    .trim()
    .max(
      maxLength,
      `${fieldName} deve possuir no máximo ${maxLength} caracteres.`
    )
    .nullable()
    .optional();
}

function positiveQuantitySchema() {
  return z.coerce
    .number({
      required_error:
        "A quantidade é obrigatória.",
      invalid_type_error:
        "A quantidade deve ser numérica.",
    })
    .finite(
      "A quantidade deve ser um número válido."
    )
    .positive(
      "A quantidade deve ser maior que zero."
    );
}

function positiveIntegerWithDefault(
  defaultValue: number,
  maximum: number
) {
  return z.preprocess(
    (value) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return defaultValue;
      }

      return value;
    },
    z.coerce
      .number()
      .int(
        "O valor deve ser um número inteiro."
      )
      .positive(
        "O valor deve ser maior que zero."
      )
      .max(
        maximum,
        `O valor máximo permitido é ${maximum}.`
      )
  );
}

const optionalIsoDate = z
  .string({
    invalid_type_error:
      "A data deve ser informada em formato textual.",
  })
  .datetime({
    offset: true,
    message:
      "A data deve estar em formato ISO 8601 válido.",
  })
  .optional();

const nullableOptionalIsoDate = z
  .string({
    invalid_type_error:
      "A data deve ser informada em formato textual.",
  })
  .datetime({
    offset: true,
    message:
      "A data deve estar em formato ISO 8601 válido.",
  })
  .nullable()
  .optional();

const metadataSchema = z
  .record(z.unknown())
  .optional();

const nullableMetadataSchema = z
  .record(z.unknown())
  .nullable()
  .optional();

/*
 * ============================================================
 * PARÂMETROS
 * ============================================================
 */

export const wasteDestinationIdParamsSchema =
  z.object({
    id: requiredTrimmedString(
      "ID da destinação",
      1,
      100
    ),
  });

export const collectionWasteEntryIdParamsSchema =
  z.object({
    entryId: requiredTrimmedString(
      "ID da entrada de resíduo",
      1,
      100
    ),
  });

/*
 * ============================================================
 * CRIAÇÃO
 * ============================================================
 */

const createWasteDestinationBaseSchema =
  z.object({
    collectionWasteEntryId:
      requiredTrimmedString(
        "Entrada de resíduo coletado",
        1,
        100
      ),

    type: wasteDestinationTypeSchema,

    quantity: positiveQuantitySchema(),

    unit: wasteDestinationUnitSchema,

    stockItemId: optionalTrimmedString(
      "Item de estoque",
      100
    ),

    stockLotCode: optionalTrimmedString(
      "Código do lote",
      100
    ),

    destinationName:
      optionalTrimmedString(
        "Nome do destino",
        255
      ),

    destinationDocument:
      optionalTrimmedString(
        "Documento do destino",
        100
      ),

    destinationAddress:
      optionalTrimmedString(
        "Endereço do destino",
        500
      ),

    destinationContact:
      optionalTrimmedString(
        "Contato do destino",
        255
      ),

    transportDocument:
      optionalTrimmedString(
        "Documento de transporte",
        255
      ),

    environmentalDocument:
      optionalTrimmedString(
        "Documento ambiental",
        255
      ),

    notes: optionalTrimmedString(
      "Observações",
      2000
    ),

    destinationDate: optionalIsoDate,

    metadata: metadataSchema,
  })
  .strict();

/*
 * ============================================================
 * REGRAS POR TIPO DE DESTINAÇÃO
 * ============================================================
 */

export const createWasteDestinationBodySchema =
  createWasteDestinationBaseSchema
    .superRefine((data, context) => {
      /*
       * ========================================================
       * DESTINAÇÃO PARA ESTOQUE
       * ========================================================
       */

      if (
        data.type ===
        WasteDestinationType.STOCK
      ) {
        if (!data.stockItemId) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["stockItemId"],

            message:
              "O item de estoque é obrigatório para destinação do tipo STOCK.",
          });
        }
      }

      /*
       * ========================================================
       * TRIAGEM
       * ========================================================
       */

      if (
        data.type ===
        WasteDestinationType.TRIAGE
      ) {
        if (!data.destinationName) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "destinationName",
            ],

            message:
              "O nome do local de triagem é obrigatório.",
          });
        }
      }

      /*
       * ========================================================
       * REJEITO
       * ========================================================
       */

      if (
        data.type ===
        WasteDestinationType.REJECT
      ) {
        if (!data.notes) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["notes"],

            message:
              "Informe o motivo ou a descrição do rejeito.",
          });
        }
      }

      /*
       * ========================================================
       * DESCARTE
       * ========================================================
       */

      if (
        data.type ===
        WasteDestinationType.DISPOSAL
      ) {
        if (!data.destinationName) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "destinationName",
            ],

            message:
              "O local de descarte é obrigatório.",
          });
        }

        if (!data.notes) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["notes"],

            message:
              "Informe o motivo ou a descrição do descarte.",
          });
        }
      }

      /*
       * ========================================================
       * DESTINAÇÃO DIRETA
       * ========================================================
       */

      if (
        data.type ===
        WasteDestinationType.DIRECT_DESTINATION
      ) {
        if (!data.destinationName) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "destinationName",
            ],

            message:
              "O destinatário é obrigatório para destinação direta.",
          });
        }
      }

      /*
       * ========================================================
       * RESERVA
       * ========================================================
       */

      if (
        data.type ===
        WasteDestinationType.RESERVATION
      ) {
        if (!data.destinationName) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "destinationName",
            ],

            message:
              "O responsável ou finalidade da reserva é obrigatório.",
          });
        }
      }

      /*
       * ========================================================
       * CAMPOS INCOMPATÍVEIS
       * ========================================================
       */

      if (
        data.type !==
          WasteDestinationType.STOCK &&
        data.stockItemId
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: ["stockItemId"],

          message:
            "O item de estoque só pode ser informado em destinações do tipo STOCK.",
        });
      }

      if (
        data.type !==
          WasteDestinationType.STOCK &&
        data.stockLotCode
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: ["stockLotCode"],

          message:
            "O código do lote só pode ser informado em destinações do tipo STOCK.",
        });
      }
    })
    .transform((data) => ({
      ...data,

      destinationDate:
        data.destinationDate
          ? new Date(
              data.destinationDate
            )
          : undefined,
    }));

/*
 * ============================================================
 * ATUALIZAÇÃO
 * ============================================================
 */

export const updateWasteDestinationBodySchema =
  z
    .object({
      type: wasteDestinationTypeSchema.optional(),

      stockItemId:
        nullableOptionalTrimmedString(
          "Item de estoque",
          100
        ),

      destinationName:
        nullableOptionalTrimmedString(
          "Nome do destino",
          255
        ),

      destinationDocument:
        nullableOptionalTrimmedString(
          "Documento do destino",
          100
        ),

      destinationAddress:
        nullableOptionalTrimmedString(
          "Endereço do destino",
          500
        ),

      destinationContact:
        nullableOptionalTrimmedString(
          "Contato do destino",
          255
        ),

      transportDocument:
        nullableOptionalTrimmedString(
          "Documento de transporte",
          255
        ),

      environmentalDocument:
        nullableOptionalTrimmedString(
          "Documento ambiental",
          255
        ),

      notes:
        nullableOptionalTrimmedString(
          "Observações",
          2000
        ),

      destinationDate:
        nullableOptionalIsoDate,

      metadata:
        nullableMetadataSchema,
    })
    .strict()
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        message:
          "Informe ao menos um campo para atualização.",
      }
    )
    .transform((data) => ({
      ...data,

      destinationDate:
        data.destinationDate === null
          ? null
          : data.destinationDate
            ? new Date(
                data.destinationDate
              )
            : undefined,
    }));

/*
 * ============================================================
 * CANCELAMENTO
 * ============================================================
 */

export const cancelWasteDestinationBodySchema =
  z
    .object({
      reason: requiredTrimmedString(
        "Motivo do cancelamento",
        3,
        1000
      ),

      cancelledAt: optionalIsoDate,
    })
    .strict()
    .transform((data) => ({
      ...data,

      cancelledAt:
        data.cancelledAt
          ? new Date(
              data.cancelledAt
            )
          : undefined,
    }));

/*
 * ============================================================
 * FILTROS DE LISTAGEM
 * ============================================================
 */

export const wasteDestinationListQuerySchema =
  z.object({
    collectionWasteEntryId:
      optionalTrimmedString(
        "Entrada de resíduo coletado",
        100
      ),

    collectionId:
      optionalTrimmedString(
        "Coleta",
        100
      ),

    collectionMaterialId:
      optionalTrimmedString(
        "Material da coleta",
        100
      ),

    type:
      wasteDestinationTypeSchema
        .optional(),

    unit:
      wasteDestinationUnitSchema
        .optional(),

    stockItemId:
      optionalTrimmedString(
        "Item de estoque",
        100
      ),

    stockLotId:
      optionalTrimmedString(
        "Lote de estoque",
        100
      ),

    generatorId:
      optionalTrimmedString(
        "Gerador",
        100
      ),

    collectorId:
      optionalTrimmedString(
        "Catador",
        100
      ),

    driverId:
      optionalTrimmedString(
        "Motorista",
        100
      ),

    vehicleId:
      optionalTrimmedString(
        "Veículo",
        100
      ),

    routeId:
      optionalTrimmedString(
        "Rota",
        100
      ),

    search:
      optionalTrimmedString(
        "Busca",
        255
      ),

    dateFrom: optionalIsoDate,

    dateTo: optionalIsoDate,

    page:
      positiveIntegerWithDefault(
        1,
        1_000_000
      ),

    limit:
      positiveIntegerWithDefault(
        50,
        200
      ),
  })
  .strict()
  .superRefine(
    (data, context) => {
      if (
        data.dateFrom &&
        data.dateTo
      ) {
        const dateFrom =
          new Date(data.dateFrom);

        const dateTo =
          new Date(data.dateTo);

        if (dateFrom > dateTo) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["dateTo"],

            message:
              "A data final deve ser igual ou posterior à data inicial.",
          });
        }
      }
    }
  );

/*
 * ============================================================
 * LISTAGEM POR ENTRADA
 * ============================================================
 */

export const entryWasteDestinationListQuerySchema =
  z.object({
    type:
      wasteDestinationTypeSchema
        .optional(),

    unit:
      wasteDestinationUnitSchema
        .optional(),

    dateFrom: optionalIsoDate,

    dateTo: optionalIsoDate,

    page:
      positiveIntegerWithDefault(
        1,
        1_000_000
      ),

    limit:
      positiveIntegerWithDefault(
        50,
        200
      ),
  })
  .strict()
  .superRefine(
    (data, context) => {
      if (
        data.dateFrom &&
        data.dateTo &&
        new Date(data.dateFrom) >
          new Date(data.dateTo)
      ) {
        context.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: ["dateTo"],

          message:
            "A data final deve ser igual ou posterior à data inicial.",
        });
      }
    }
  );

/*
 * ============================================================
 * TIPOS INFERIDOS
 * ============================================================
 */

export type WasteDestinationTypeInput =
  z.infer<
    typeof wasteDestinationTypeSchema
  >;

export type WasteDestinationUnitInput =
  z.infer<
    typeof wasteDestinationUnitSchema
  >;

export type WasteDestinationIdParams =
  z.infer<
    typeof wasteDestinationIdParamsSchema
  >;

export type CollectionWasteEntryIdParams =
  z.infer<
    typeof collectionWasteEntryIdParamsSchema
  >;

export type CreateWasteDestinationBody =
  z.infer<
    typeof createWasteDestinationBodySchema
  >;

export type UpdateWasteDestinationBody =
  z.infer<
    typeof updateWasteDestinationBodySchema
  >;

export type CancelWasteDestinationBody =
  z.infer<
    typeof cancelWasteDestinationBodySchema
  >;

export type WasteDestinationListQuery =
  z.infer<
    typeof wasteDestinationListQuerySchema
  >;

export type EntryWasteDestinationListQuery =
  z.infer<
    typeof entryWasteDestinationListQuerySchema
  >;