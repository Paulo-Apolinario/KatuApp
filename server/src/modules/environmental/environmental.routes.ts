import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import { prisma } from "../../lib/prisma";
import {
  accessSchema,
  documentSchema,
  editDocumentSchema,
  families,
  transitionSchema,
  unitSchema,
  validatePayload,
  version,
} from "./environmental.schemas";
import {
  actorContext,
  environmentalService as s,
  EnvironmentalError,
  findDocument,
} from "./environmental.service";
const privateRoot = path.join(process.cwd(), "private-environmental-files");
const idSchema = z.object({ id: z.string().min(1).max(100) }).passthrough();
const paging = z
  .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
  .passthrough();
const listSchema = paging
  .extend({
    unitId: z.string().min(1).max(100),
    family: z.enum(families).optional(),
    status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"]).optional(),
  })
  .strict();
export async function environmentalRoutes(app: FastifyInstance) {
  const handle =
    (
      fn: (
        req: any,
        reply: any,
        ctx: Awaited<ReturnType<typeof actorContext>>,
      ) => Promise<unknown>,
    ) =>
    async (req: any, reply: any) => {
      try {
        const ctx = await actorContext(req.user.sub);
        return await fn(req, reply, ctx);
      } catch (error: any) {
        if (error instanceof ZodError)
          return reply
            .code(400)
            .send({
              error: error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join(" "),
              code: "VALIDATION_ERROR",
            });
        if (error instanceof EnvironmentalError)
          return reply
            .code(error.statusCode)
            .send({ error: error.message, code: error.code });
        if (error.code === "P2002")
          return reply
            .code(409)
            .send({ error: "Já existe um registro com essa identificação." });
        if (error.statusCode === 413 || error.code === "FST_REQ_FILE_TOO_LARGE")
          return reply
            .code(413)
            .send({ error: "Arquivo excede o limite de 10 MB." });
        req.log.error({ code: error.code }, "Falha na central ambiental");
        return reply
          .code(500)
          .send({
            error:
              "Não foi possível concluir a operação ambiental. Tente novamente.",
          });
      }
    };
  const auth = { preHandler: [app.authenticate] };
  app.get(
    "/environmental/context",
    auth,
    handle(async (_r, _p, c) => ({ data: await s.context(c) })),
  );
  app.get(
    "/environmental/units",
    auth,
    handle(async (_r, _p, c) => ({ data: await s.units(c) })),
  );
  app.post(
    "/environmental/units",
    auth,
    handle(async (r, p, c) =>
      p.code(201).send({ data: await s.saveUnit(c, unitSchema.parse(r.body)) }),
    ),
  );
  app.put(
    "/environmental/units/:id",
    auth,
    handle(async (r, _p, c) => {
      const { version: v, ...data } = unitSchema
        .extend({ version })
        .parse(r.body);
      return {
        data: await s.saveUnit(c, data, idSchema.parse(r.params).id, v),
      };
    }),
  );
  app.get(
    "/environmental/documents",
    auth,
    handle(async (r, _p, c) => ({
      data: await s.list(c, listSchema.parse(r.query)),
    })),
  );
  app.post(
    "/environmental/documents",
    auth,
    handle(async (r, p, c) =>
      p
        .code(201)
        .send({ data: await s.create(c, documentSchema.parse(r.body)) }),
    ),
  );
  app.get(
    "/environmental/documents/:id",
    auth,
    handle(async (r, _p, c) => ({
      data: await s.detail(c, idSchema.parse(r.params).id),
    })),
  );
  app.put(
    "/environmental/documents/:id",
    auth,
    handle(async (r, _p, c) => {
      const id = idSchema.parse(r.params).id;
      const d = await findDocument(c, id, true);
      const input = editDocumentSchema.parse(r.body);
      return {
        data: await s.update(c, id, {
          ...input,
          payload: validatePayload(d.family, input.payload),
        }),
      };
    }),
  );
  app.post(
    "/environmental/documents/:id/transition",
    auth,
    handle(async (r, _p, c) => ({
      data: await s.transition(
        c,
        idSchema.parse(r.params).id,
        transitionSchema.parse(r.body),
      ),
    })),
  );
  app.get(
    "/environmental/documents/:id/history",
    auth,
    handle(async (r, _p, c) => ({
      data: await s.history(
        c,
        idSchema.parse(r.params).id,
        paging.parse(r.query).page,
      ),
    })),
  );
  app.post(
    "/environmental/documents/:id/submit",
    auth,
    handle(async (r, _p, c) => ({
      data: await s.submit(
        c,
        idSchema.parse(r.params).id,
        z.object({ version }).strict().parse(r.body).version,
      ),
    })),
  );
  app.get(
    "/environmental/units/:id/collection-source/:collectionId",
    auth,
    handle(async (r, _p, c) => {
      const ids = idSchema
        .extend({ collectionId: z.string().min(1).max(100) })
        .parse(r.params);
      return { data: await s.importCollection(c, ids.id, ids.collectionId) };
    }),
  );
  app.post(
    "/environmental/municipal-access",
    auth,
    handle(async (r, _p, c) => ({
      data: await s.grant(c, accessSchema.parse(r.body)),
    })),
  );
  app.post(
    "/environmental/documents/:id/attachments",
    auth,
    handle(async (r, p, c) => {
      const id = idSchema.parse(r.params).id;
      await findDocument(c, id, true);
      const v = z
        .object({ version: z.coerce.number().int().positive() })
        .strict()
        .parse(r.query).version;
      const file = await r.file({
        limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      });
      if (!file || file.fieldname !== "file")
        throw new EnvironmentalError("Selecione uma evidência no campo file.");
      const buffer = await file.toBuffer();
      if (file.file.truncated)
        throw new EnvironmentalError("Arquivo excede 10 MB.", 413);
      const isPdf = buffer.subarray(0, 5).toString() === "%PDF-",
        isPng = buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        isJpg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
      const mediaType = isPdf
        ? "application/pdf"
        : isPng
          ? "image/png"
          : isJpg
            ? "image/jpeg"
            : null;
      if (!mediaType || mediaType !== file.mimetype)
        throw new EnvironmentalError(
          "Use um PDF, PNG ou JPEG válido, até 10 MB.",
        );
      const storageKey =
        randomUUID() + (isPdf ? ".pdf" : isPng ? ".png" : ".jpg");
      const filename =
        path
          .basename(file.filename)
          .replace(/[\x00-\x1f\x7f]/g, "")
          .slice(0, 180) || "evidencia";
      await mkdir(privateRoot, { recursive: true });
      await writeFile(path.join(privateRoot, storageKey), buffer, {
        flag: "wx",
        mode: 0o600,
      });
      try {
        return p
          .code(201)
          .send({
            data: await s.addAttachment(c, id, v, {
              filename,
              storageKey,
              mediaType,
              size: buffer.length,
              sha256: createHash("sha256").update(buffer).digest("hex"),
            }),
          });
      } catch (e) {
        await unlink(path.join(privateRoot, storageKey)).catch(() => {});
        throw e;
      }
    }),
  );
  app.get(
    "/environmental/documents/:id/attachments/:attachmentId",
    auth,
    handle(async (r, p, c) => {
      const ids = idSchema
        .extend({ attachmentId: z.string().min(1).max(100) })
        .parse(r.params);
      await findDocument(c, ids.id);
      const a = await prisma.environmentalAttachment.findFirst({
        where: { id: ids.attachmentId, documentId: ids.id },
      });
      if (!a) throw new EnvironmentalError("Evidência não encontrada.", 404);
      if (!/^[a-f0-9-]+\.(pdf|png|jpg)$/.test(a.storageKey))
        throw new EnvironmentalError("Referência de arquivo inválida.", 500);
      let data;
      try {
        data = await readFile(path.join(privateRoot, a.storageKey));
      } catch {
        throw new EnvironmentalError(
          "Arquivo indisponível. Consulte o responsável pelo armazenamento.",
          404,
        );
      }
      return p
        .header("Content-Type", a.mediaType)
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "private, no-store")
        .header(
          "Content-Disposition",
          `attachment; filename="evidencia${path.extname(a.storageKey)}"`,
        )
        .send(data);
    }),
  );
}
