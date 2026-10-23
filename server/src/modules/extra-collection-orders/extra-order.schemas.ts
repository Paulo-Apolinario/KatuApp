import { z } from "zod";
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const uuid = z.string().uuid();
const material = z
  .object({
    wasteTypeId: z.string().min(1).optional(),
    nameSnapshot: text(2, 150).optional(),
    proposedMaterial: z
      .object({
        name: text(2, 150),
        unit: z.enum(["KG", "TON", "LITER", "UNIT", "CUBIC_METER"]),
      })
      .optional(),
    unit: z.enum(["KG", "TON", "LITER", "UNIT", "CUBIC_METER"]),
    quantity: z.number().positive().max(1e9).optional(),
  })
  .refine(
    (m) => Boolean(m.wasteTypeId) !== Boolean(m.proposedMaterial),
    "Selecione um material do catálogo ou uma proposta.",
  );
export const extraOrderPayload = z
  .object({
    recordedAt: z.string().datetime({ offset: true }).optional(),
    mode: z.enum(["REQUESTED", "COLLECTED"]),
    reason: z.enum([
      "UNPLANNED_STOP",
      "EXTRA_REQUEST",
      "OUTSIDE_SCHEDULE",
      "WEEKEND",
      "OTHER",
    ]),
    reasonNotes: text(5, 2000),
    originType: z.enum(["PF", "GENERATOR"]),
    originName: text(2, 180),
    contactPhone: text(0, 40).optional(),
    pickupAddress: text(5, 500),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    accuracyMeters: z.number().nonnegative().max(100000).optional(),
    generatorId: z.string().min(1).optional(),
    sourceScheduleId: z.string().min(1).optional(),
    contextRouteId: z.string().min(1).optional(),
    occurredAt: z.string().datetime({ offset: true }).optional(),
    preferredDate: z.string().datetime({ offset: true }).optional(),
    custody: z.enum(["ORIGIN", "COLLECTOR", "COOPERATIVE", "OTHER"]),
    custodyNotes: text(5, 1000),
    materials: z.array(material).min(1).max(50),
    photos: z
      .array(
        z
          .string()
          .max(700000)
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
      )
      .max(3)
      .default([]),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string, path: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
    if ((p.latitude == null) !== (p.longitude == null))
      issue("Informe latitude e longitude juntas.", "latitude");
    if (p.generatorId && p.originType !== "GENERATOR")
      issue(
        "O vínculo do gerador não corresponde à origem informada.",
        "generatorId",
      );
    if (p.reason === "UNPLANNED_STOP" && !p.contextRouteId)
      issue(
        "Selecione a rota em que ocorreu a parada extra.",
        "contextRouteId",
      );
    if (
      p.mode === "COLLECTED" &&
      (!p.occurredAt || p.materials.some((m) => !m.quantity))
    )
      issue(
        "Coleta realizada exige data e quantidades efetivas.",
        "occurredAt",
      );
    if (p.occurredAt && new Date(p.occurredAt).getTime() > Date.now() + 300000)
      issue("A realização não pode estar no futuro.", "occurredAt");
    if (p.mode === "REQUESTED" && p.occurredAt)
      issue(
        "Solicitação ainda não realizada não pode ter data de coleta.",
        "occurredAt",
      );
    if (p.mode === "REQUESTED" && p.custody !== "ORIGIN")
      issue(
        "Material ainda não coletado deve permanecer na origem.",
        "custody",
      );
    const keys = new Set<string>();
    for (const m of p.materials) {
      const key =
        m.wasteTypeId ||
        `${m.proposedMaterial?.name.trim().toLocaleLowerCase("pt-BR")}:${m.unit}`;
      if (keys.has(key))
        issue("Material repetido na O.C. Agrupe as quantidades.", "materials");
      keys.add(key);
      if (m.proposedMaterial && m.proposedMaterial.unit !== m.unit)
        issue(
          "A unidade da proposta deve corresponder ao material.",
          "materials",
        );
    }
    if (
      p.photos.reduce(
        (sum, photo) => sum + Buffer.from(photo.split(",")[1], "base64").length,
        0,
      ) > 614400
    )
      issue("As fotos juntas devem ter até 600 KB.", "photos");
    for (const photo of p.photos) {
      const raw = Buffer.from(photo.split(",")[1], "base64");
      if (raw.length > 512000)
        issue("Cada foto deve ter até 500 KB.", "photos");
      const jpeg =
        photo.startsWith("data:image/jpeg") &&
        raw[0] === 255 &&
        raw[1] === 216 &&
        raw[2] === 255;
      const png =
        photo.startsWith("data:image/png") &&
        raw
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp =
        photo.startsWith("data:image/webp") &&
        raw.toString("ascii", 0, 4) === "RIFF" &&
        raw.toString("ascii", 8, 12) === "WEBP";
      if (!jpeg && !png && !webp) issue("Formato de foto inválido.", "photos");
    }
  });
export const createExtraOrder = z.object({
  id: uuid,
  cooperativeId: z.string().min(1),
  payload: extraOrderPayload,
});
export const reviseExtraOrder = z.object({
  operationId: uuid,
  expectedRevision: z.number().int().positive(),
  payload: extraOrderPayload,
});
export const reviewExtraOrder = z
  .object({
    operationId: uuid,
    expectedRevision: z.number().int().positive(),
    decision: z.enum(["ACCEPT", "NEEDS_INFO", "REJECT"]),
    notes: text(5, 2000),
    scheduledDate: z.string().datetime({ offset: true }).optional(),
    driverId: z.string().min(1).optional(),
    vehicleId: z.string().min(1).optional(),
    custody: z.enum(["ORIGIN", "COLLECTOR", "COOPERATIVE", "OTHER"]).optional(),
    custodyNotes: text(5, 1000).optional(),
  })
  .superRefine((v, c) => {
    if (v.decision === "REJECT" && (!v.custody || !v.custodyNotes))
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Registre onde está o material e o encaminhamento dado à recusa.",
        path: ["custodyNotes"],
      });
  });
export const receiveExtraOrder = z.object({
  operationId: uuid,
  receivedAt: z.string().datetime({ offset: true }),
  notes: text(5, 1000),
});
export type ExtraOrderPayload = z.infer<typeof extraOrderPayload>;
