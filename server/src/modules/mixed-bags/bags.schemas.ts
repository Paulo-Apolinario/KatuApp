import { z } from "zod";
import { Prisma } from "@prisma/client";
export const weight = z
  .number()
  .finite()
  .min(0)
  .max(1e7)
  .refine(
    (value) => new Prisma.Decimal(value).decimalPlaces() <= 3,
    "Use até três casas decimais.",
  );
const text = z.string().trim();
export const receiveBag = z
  .object({
    operationId: z.string().uuid(),
    collectionId: text.min(1).max(100).optional(),
    externalTag: text.max(60).optional(),
    grossKg: weight.refine((v) => v > 0, "Informe o peso bruto."),
    tareKg: weight.default(0),
    originLabel: text.min(2).max(200),
    generatorIds: z.array(text.min(1).max(100)).max(50).default([]),
    storageLocation: text.max(100).default(""),
    notes: text.max(1500).default(""),
  })
  .strict()
  .refine(
    (v) => v.grossKg > v.tareKg,
    "A tara precisa ser menor que o peso bruto.",
  );
export const mutation = z
  .object({
    operationId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const sorting = mutation
  .extend({
    participantIds: z.array(text.min(1).max(100)).max(30).default([]),
    outputs: z
      .array(
        z
          .object({
            itemId: text.min(1).max(100),
            quantityKg: weight.refine(
              (v) => v > 0,
              "Informe a quantidade separada.",
            ),
            lotId: text.min(1).max(100).optional(),
            expectedLotVersion: z.number().int().positive().optional(),
          })
          .strict()
          .refine(
            (v) => !v.lotId || v.expectedLotVersion != null,
            "Atualize o lote de destino antes de confirmar.",
          ),
      )
      .max(50),
    rejectedKg: weight.default(0),
    notes: text.max(1500).default(""),
  })
  .refine(
    (v) => v.outputs.length > 0 || v.rejectedKg > 0,
    "Informe material separado ou rejeito.",
  )
  .refine(
    (v) => v.rejectedKg === 0 || v.notes.length >= 3,
    "Descreva o rejeito identificado.",
  );
export const adjust = mutation
  .extend({
    grossKg: weight.refine((v) => v > 0),
    tareKg: weight,
    notes: text.min(5).max(1500),
  })
  .refine(
    (v) => v.grossKg > v.tareKg,
    "A tara precisa ser menor que o peso bruto.",
  );
export const cancel = mutation.extend({ notes: text.min(5).max(1500) });
export const query = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    status: z
      .enum(["ALL", "WAITING", "SORTING", "COMPLETED", "CANCELLED"])
      .default("ALL"),
    search: text.max(100).default(""),
  })
  .strict();
