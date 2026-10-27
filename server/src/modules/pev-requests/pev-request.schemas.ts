import { z } from "zod";
export const evidencePhotos = z
  .array(
    z
      .string()
      .max(280000)
      .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
  )
  .max(3)
  .default([])
  .superRefine((photos, ctx) => {
    let total = 0;
    for (const photo of photos) {
      const raw = Buffer.from(photo.split(",")[1], "base64");
      total += raw.length;
      const valid = photo.startsWith("data:image/jpeg;")
        ? raw[0] === 255 && raw[1] === 216 && raw[2] === 255
        : photo.startsWith("data:image/png;")
          ? raw
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : raw.toString("ascii", 0, 4) === "RIFF" &&
            raw.toString("ascii", 8, 12) === "WEBP";
      if (!valid || raw.length > 204800)
        ctx.addIssue({
          code: "custom",
          message: "Envie fotos JPG, PNG ou WEBP válidas, até 200 KB cada.",
        });
    }
    if (total > 614400)
      ctx.addIssue({
        code: "custom",
        message: "As fotos juntas devem ter até 600 KB.",
      });
  });
export const createPevRequest = z
  .object({
    id: z.string().uuid(),
    binId: z.string().min(1).max(100),
    condition: z.enum(["FULL", "OVERFLOW", "DAMAGED", "CONTAMINATED", "OTHER"]),
    notes: z.string().trim().min(5).max(1500),
    photos: evidencePhotos,
  })
  .strict();
export const updatePevRequest = z
  .object({
    operationId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    kind: z.enum(["EVIDENCE", "REVIEW", "RESOLVE", "DISMISS"]),
    notes: z.string().trim().min(5).max(1500),
    photos: evidencePhotos,
  })
  .strict();
export const pevRequestQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  binId: z.string().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["OPEN", "ASSIGNED", "RESOLVED", "DISMISSED"]).optional(),
});
