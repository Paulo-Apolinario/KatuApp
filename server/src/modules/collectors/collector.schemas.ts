import { z } from "zod";

/**
 * Status operacional do catador.
 */
export const collectorStatusSchema = z.enum(
  ["AVAILABLE", "ON_ROUTE", "INACTIVE"],
  {
    errorMap: () => ({
      message: "Status do catador inválido.",
    }),
  }
);

/**
 * Sexo declarado pelo catador.
 *
 * Os valores devem permanecer iguais ao enum CollectorSex
 * existente no schema.prisma.
 */
export const collectorSexSchema = z.enum(
  ["FEMALE", "MALE", "INTERSEX", "NOT_INFORMED"],
  {
    errorMap: () => ({
      message: "Sexo informado inválido.",
    }),
  }
);

/**
 * Identidade de gênero declarada pelo catador.
 *
 * Os valores devem permanecer iguais ao enum CollectorGender
 * existente no schema.prisma.
 */
export const collectorGenderSchema = z.enum(
  [
    "CIS_WOMAN",
    "CIS_MAN",
    "TRANS_WOMAN",
    "TRANS_MAN",
    "NON_BINARY",
    "OTHER",
    "NOT_INFORMED",
  ],
  {
    errorMap: () => ({
      message: "Gênero informado inválido.",
    }),
  }
);

/**
 * Normaliza campos opcionais de texto.
 *
 * Valores vazios são transformados em undefined.
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

      const normalizedValue = value.trim();

      return normalizedValue === ""
        ? undefined
        : normalizedValue;
    },
    z
      .string()
      .max(
        maxLength,
        `O campo deve possuir no máximo ${maxLength} caracteres.`
      )
      .optional()
  );

/**
 * Normaliza campos opcionais de texto longo.
 */
const optionalLongString = (maxLength = 3000) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      const normalizedValue = value.trim();

      return normalizedValue === ""
        ? undefined
        : normalizedValue;
    },
    z
      .string()
      .max(
        maxLength,
        `O campo deve possuir no máximo ${maxLength} caracteres.`
      )
      .optional()
  );

/**
 * Converte valores recebidos por FormData em boolean.
 */
const optionalBooleanSchema = z.preprocess(
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
    }

    if (typeof value === "string") {
      const normalizedValue = value
        .trim()
        .toLowerCase();

      if (
        ["true", "1", "sim", "yes"].includes(
          normalizedValue
        )
      ) {
        return true;
      }

      if (
        ["false", "0", "não", "nao", "no"].includes(
          normalizedValue
        )
      ) {
        return false;
      }
    }

    return value;
  },
  z.boolean({
    invalid_type_error:
      "O campo autônomo deve ser verdadeiro ou falso.",
  }).optional()
);

/**
 * Valida datas no formato YYYY-MM-DD.
 *
 * O service fará a conversão da data de associação
 * para um objeto Date.
 */
const optionalDateStringSchema = z.preprocess(
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

    const normalizedValue = value.trim();

    return normalizedValue === ""
      ? undefined
      : normalizedValue;
  },
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "A data deve estar no formato AAAA-MM-DD."
    )
    .refine((value) => {
      const parsedDate = new Date(
        `${value}T00:00:00.000Z`
      );

      return !Number.isNaN(parsedDate.getTime());
    }, "Data inválida.")
    .optional()
);

/**
 * CPF opcional, armazenado apenas com números.
 */
const optionalCpfSchema = z.preprocess(
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

    const normalizedValue = value.replace(/\D/g, "");

    return normalizedValue === ""
      ? undefined
      : normalizedValue;
  },
  z
    .string()
    .length(
      11,
      "O CPF deve possuir 11 dígitos."
    )
    .optional()
);

/**
 * Telefone opcional.
 */
const optionalPhoneSchema = z.preprocess(
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

    const normalizedValue = value.trim();

    return normalizedValue === ""
      ? undefined
      : normalizedValue;
  },
  z
    .string()
    .min(8, "Telefone inválido.")
    .max(
      30,
      "O telefone deve possuir no máximo 30 caracteres."
    )
    .optional()
);

/**
 * Enum opcional de sexo.
 */
const optionalCollectorSexSchema = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return undefined;
    }

    if (typeof value === "string") {
      return value.trim().toUpperCase();
    }

    return value;
  },
  collectorSexSchema.optional()
);

/**
 * Enum opcional de gênero.
 */
const optionalCollectorGenderSchema = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return undefined;
    }

    if (typeof value === "string") {
      return value.trim().toUpperCase();
    }

    return value;
  },
  collectorGenderSchema.optional()
);

/**
 * Enum opcional de status.
 */
const optionalCollectorStatusSchema = z.preprocess(
  (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return undefined;
    }

    if (typeof value === "string") {
      return value.trim().toUpperCase();
    }

    return value;
  },
  collectorStatusSchema.optional()
);

/**
 * Cadastro completo do catador.
 *
 * Compatível com:
 * - application/json
 * - multipart/form-data
 */
export const createCollectorSchema = z.object({
  name: z
    .string({
      required_error:
        "O nome do catador é obrigatório.",
      invalid_type_error:
        "O nome do catador deve ser um texto.",
    })
    .trim()
    .min(
      2,
      "O nome deve possuir pelo menos 2 caracteres."
    )
    .max(
      150,
      "O nome deve possuir no máximo 150 caracteres."
    ),

  socialName: optionalTrimmedString(150),

  email: z
    .string({
      required_error:
        "O e-mail do catador é obrigatório.",
      invalid_type_error:
        "O e-mail deve ser um texto.",
    })
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .max(
      255,
      "O e-mail deve possuir no máximo 255 caracteres."
    ),

  phone: optionalPhoneSchema,

  cpf: optionalCpfSchema,

  rg: optionalTrimmedString(30),

  birthDate: optionalDateStringSchema,

  sex: optionalCollectorSexSchema,

  gender: optionalCollectorGenderSchema,

  address: optionalTrimmedString(500),

  associationDate: optionalDateStringSchema,

  isAutonomous:
    optionalBooleanSchema.default(false),

  incomeRange: optionalTrimmedString(100),

  socialBenefits: optionalLongString(1500),

  occupationalDiseases:
    optionalLongString(1500),

  socioeconomicNotes:
    optionalLongString(3000),

  status: optionalCollectorStatusSchema,
});

/**
 * Parâmetro contendo somente o ID do catador.
 */
export const collectorIdParamsSchema = z.object({
  id: z
    .string({
      required_error:
        "O ID do catador é obrigatório.",
      invalid_type_error:
        "O ID do catador deve ser um texto.",
    })
    .trim()
    .min(1, "ID do catador inválido."),
});

/**
 * Parâmetros utilizados para excluir um documento.
 */
export const collectorDocumentParamsSchema = z.object({
  id: z
    .string({
      required_error:
        "O ID do catador é obrigatório.",
    })
    .trim()
    .min(1, "ID do catador inválido."),

  documentId: z
    .string({
      required_error:
        "O ID do documento é obrigatório.",
    })
    .trim()
    .min(1, "ID do documento inválido."),
});

/**
 * Atualização exclusiva do status operacional.
 */
export const updateCollectorStatusSchema = z.object({
  status: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        return value.trim().toUpperCase();
      }

      return value;
    },
    collectorStatusSchema
  ),
});

/**
 * Metadados opcionais de um documento.
 *
 * O arquivo físico será processado pelo controller.
 */
export const collectorDocumentMetadataSchema = z.object({
  documentType: optionalTrimmedString(100),

  documentName: optionalTrimmedString(255),

  notes: optionalLongString(1000),
});

export type CreateCollectorInput = z.infer<
  typeof createCollectorSchema
>;

export type CollectorIdParams = z.infer<
  typeof collectorIdParamsSchema
>;

export type CollectorDocumentParams = z.infer<
  typeof collectorDocumentParamsSchema
>;

export type UpdateCollectorStatusInput = z.infer<
  typeof updateCollectorStatusSchema
>;

export type CollectorDocumentMetadataInput = z.infer<
  typeof collectorDocumentMetadataSchema
>;