import { z } from "zod";

/*
 * ============================================================
 * ENUMS
 * ============================================================
 */

/**
 * Status operacional de uma entrada de resíduo coletado.
 *
 * Os valores precisam permanecer iguais ao enum
 * CollectionEntryStatus do schema.prisma.
 */
export const collectionEntryStatusSchema = z.enum(
  [
    "PENDING_DESTINATION",
    "SENT_TO_TRIAGE",
    "ADDED_TO_STOCK",
    "PARTIALLY_DESTINED",
    "FULLY_DESTINED",
    "REJECTED",
    "DISCARDED",
    "DIRECTLY_DESTINED",
    "RESERVED",
    "CANCELLED",
  ],
  {
    errorMap: () => ({
      message:
        "Status da entrada de resíduo inválido.",
    }),
  }
);

/**
 * Unidades aceitas nas entradas de resíduos.
 *
 * Os valores precisam permanecer iguais ao enum WasteUnit.
 */
export const collectionEntryWasteUnitSchema = z.enum(
  [
    "KG",
    "TON",
    "LITER",
    "UNIT",
    "CUBIC_METER",
  ],
  {
    errorMap: () => ({
      message:
        "Unidade de medida da entrada inválida.",
    }),
  }
);

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

/**
 * Normaliza strings opcionais.
 *
 * Strings vazias, null e undefined tornam-se undefined.
 */
const optionalTrimmedString = (
  maxLength = 255
) =>
  z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined
      ) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();

      return normalized === ""
        ? undefined
        : normalized;
    },
    z
      .string({
        invalid_type_error:
          "O campo deve ser um texto.",
      })
      .max(
        maxLength,
        `O campo deve possuir no máximo ${maxLength} caracteres.`
      )
      .optional()
  );

/**
 * String obrigatória e normalizada.
 */
const requiredTrimmedString = (
  fieldName: string,
  maxLength = 100
) =>
  z
    .string({
      required_error:
        `${fieldName} é obrigatório.`,
      invalid_type_error:
        `${fieldName} deve ser um texto.`,
    })
    .trim()
    .min(
      1,
      `${fieldName} é obrigatório.`
    )
    .max(
      maxLength,
      `${fieldName} deve possuir no máximo ${maxLength} caracteres.`
    );

/**
 * Converte parâmetros de paginação recebidos como string.
 */
const positiveIntegerWithDefault = (
  defaultValue: number,
  maximum?: number
) =>
  z.preprocess(
    (value) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return defaultValue;
      }

      if (typeof value === "number") {
        return value;
      }

      if (typeof value === "string") {
        return Number(value.trim());
      }

      return value;
    },
    z
      .number({
        invalid_type_error:
          "Informe um número válido.",
      })
      .int(
        "O valor deve ser um número inteiro."
      )
      .positive(
        "O valor deve ser maior que zero."
      )
      .refine(
        (value) =>
          maximum === undefined ||
          value <= maximum,
        {
          message:
            maximum === undefined
              ? "Valor inválido."
              : `O valor máximo permitido é ${maximum}.`,
        }
      )
      .default(defaultValue)
  );

/**
 * Converte booleanos enviados pela query string.
 *
 * Valores aceitos:
 * - true
 * - false
 * - 1
 * - 0
 * - yes
 * - no
 * - sim
 * - nao
 * - não
 */
const optionalBoolean = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;

      return value;
    }

    if (typeof value === "string") {
      const normalized = value
        .trim()
        .toLocaleLowerCase("pt-BR");

      if (
        [
          "true",
          "1",
          "yes",
          "sim",
        ].includes(normalized)
      ) {
        return true;
      }

      if (
        [
          "false",
          "0",
          "no",
          "nao",
          "não",
        ].includes(normalized)
      ) {
        return false;
      }
    }

    return value;
  },
  z
    .boolean({
      invalid_type_error:
        "Informe um valor booleano válido.",
    })
    .optional()
);

/**
 * Normaliza datas ISO opcionais.
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

/**
 * Normaliza um status opcional.
 */
const optionalCollectionEntryStatus =
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
    collectionEntryStatusSchema.optional()
  );

/**
 * Normaliza uma unidade opcional.
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
  collectionEntryWasteUnitSchema.optional()
);

/*
 * ============================================================
 * PARÂMETROS
 * ============================================================
 */

/**
 * Parâmetro contendo o ID da entrada de resíduo.
 */
export const collectionEntryIdParamsSchema =
  z.object({
    id: requiredTrimmedString(
      "O ID da entrada de resíduo"
    ),
  });

/*
 * ============================================================
 * FILTROS DE LISTAGEM
 * ============================================================
 */

/**
 * Filtros utilizados pelo endpoint:
 *
 * GET /collection-entries
 */
export const collectionEntryListQuerySchema =
  z
    .object({
      status:
        optionalCollectionEntryStatus,

      wasteTypeId:
        optionalTrimmedString(100),

      collectionId:
        optionalTrimmedString(100),

      collectionMaterialId:
        optionalTrimmedString(100),

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

      unit: optionalWasteUnit,

      search:
        optionalTrimmedString(200),

      dateFrom: optionalIsoDate,

      dateTo: optionalIsoDate,

      /**
       * Quando true, retorna somente entradas com:
       *
       * remainingQuantity > 0
       */
      onlyWithBalance:
        optionalBoolean,

      page:
        positiveIntegerWithDefault(
          1
        ),

      limit:
        positiveIntegerWithDefault(
          50,
          200
        ),
    })
    .superRefine((data, context) => {
      if (
        data.dateFrom &&
        data.dateTo
      ) {
        const dateFrom =
          new Date(data.dateFrom);

        const dateTo =
          new Date(data.dateTo);

        if (
          dateFrom.getTime() >
          dateTo.getTime()
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["dateTo"],

            message:
              "A data final não pode ser anterior à data inicial.",
          });
        }
      }
    });

/*
 * ============================================================
 * FILTROS DE ENTRADAS PENDENTES
 * ============================================================
 */

/**
 * Filtros utilizados pelo endpoint:
 *
 * GET /collection-entries/pending
 *
 * O service aplicará automaticamente:
 *
 * remainingQuantity > 0
 *
 * e excluirá entradas encerradas ou canceladas.
 */
export const pendingCollectionEntryQuerySchema =
  z
    .object({
      wasteTypeId:
        optionalTrimmedString(100),

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

      unit: optionalWasteUnit,

      search:
        optionalTrimmedString(200),

      dateFrom: optionalIsoDate,

      dateTo: optionalIsoDate,

      page:
        positiveIntegerWithDefault(
          1
        ),

      limit:
        positiveIntegerWithDefault(
          50,
          200
        ),
    })
    .superRefine((data, context) => {
      if (
        data.dateFrom &&
        data.dateTo
      ) {
        const dateFrom =
          new Date(data.dateFrom);

        const dateTo =
          new Date(data.dateTo);

        if (
          dateFrom.getTime() >
          dateTo.getTime()
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["dateTo"],

            message:
              "A data final não pode ser anterior à data inicial.",
          });
        }
      }
    });

/*
 * ============================================================
 * FILTROS DO RESUMO
 * ============================================================
 */

/**
 * Filtros utilizados pelo endpoint:
 *
 * GET /collection-entries/summary
 *
 * O resumo não possui paginação.
 */
export const collectionEntrySummaryQuerySchema =
  z
    .object({
      status:
        optionalCollectionEntryStatus,

      wasteTypeId:
        optionalTrimmedString(100),

      collectionId:
        optionalTrimmedString(100),

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

      unit: optionalWasteUnit,

      search:
        optionalTrimmedString(200),

      dateFrom: optionalIsoDate,

      dateTo: optionalIsoDate,

      onlyWithBalance:
        optionalBoolean,
    })
    .superRefine((data, context) => {
      if (
        data.dateFrom &&
        data.dateTo
      ) {
        const dateFrom =
          new Date(data.dateFrom);

        const dateTo =
          new Date(data.dateTo);

        if (
          dateFrom.getTime() >
          dateTo.getTime()
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["dateTo"],

            message:
              "A data final não pode ser anterior à data inicial.",
          });
        }
      }
    });

/*
 * ============================================================
 * TIPOS TYPESCRIPT
 * ============================================================
 */

export type CollectionEntryStatusInput =
  z.infer<
    typeof collectionEntryStatusSchema
  >;

export type CollectionEntryWasteUnitInput =
  z.infer<
    typeof collectionEntryWasteUnitSchema
  >;

export type CollectionEntryIdParams =
  z.infer<
    typeof collectionEntryIdParamsSchema
  >;

export type CollectionEntryListQuery =
  z.infer<
    typeof collectionEntryListQuerySchema
  >;

export type PendingCollectionEntryQuery =
  z.infer<
    typeof pendingCollectionEntryQuerySchema
  >;

export type CollectionEntrySummaryQuery =
  z.infer<
    typeof collectionEntrySummaryQuerySchema
  >;