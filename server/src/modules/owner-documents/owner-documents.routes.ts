import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, realpath, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
const kindSchema = z.enum(["generator", "collector", "driver", "vehicle"]);
const querySchema = z.object({ kind: kindSchema, ownerId: z.string().min(1) });
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida.",
  )
  .optional();
const metadata = querySchema
  .extend({
    title: text(2, 180),
    documentType: text(2, 100),
    documentNumber: text(0, 100).optional(),
    issueDate: date,
    expiryDate: date,
    notes: text(0, 2000).optional(),
  })
  .refine(
    (d) => !d.issueDate || !d.expiryDate || d.expiryDate >= d.issueDate,
    "Vencimento anterior à emissão.",
  );
export const privateDocumentDir = () =>
  path.resolve(
    process.env.DOCUMENT_STORAGE_DIR ||
      path.join(process.cwd(), "storage", "documents"),
  );
const fail = (message: string, statusCode = 400): never => {
  throw Object.assign(Error(message), { statusCode });
};
export function documentFormat(b: Buffer) {
  if (b.subarray(0, 5).toString() === "%PDF-")
    return { mime: "application/pdf", ext: "pdf" };
  if (b.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return { mime: "image/jpeg", ext: "jpg" };
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { mime: "image/png", ext: "png" };
  if (
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  return fail("Formato inválido. Envie PDF, JPG, PNG ou WEBP.");
}
async function scope(r: any) {
  if (r.user.role !== "COOPERATIVE")
    fail("Acesso exclusivo da cooperativa responsável.", 403);
  const c = await prisma.cooperative.findUnique({
    where: { userId: r.user.sub },
    select: { id: true },
  });
  if (!c) fail("Cooperativa não encontrada.", 403);
  return c!.id;
}
async function owner(
  cooperativeId: string,
  kind: z.infer<typeof kindSchema>,
  id: string,
) {
  if (
    !(await (prisma[kind] as any).findFirst({
      where: { id, cooperativeId },
      select: { id: true },
    }))
  )
    fail("Cadastro não encontrado nesta cooperativa.", 404);
}
const cleanName = (v: string) =>
  path
    .basename(v.replace(/\\/g, "/"))
    .replace(/[\u0000-\u001f\u007f";]/g, "")
    .slice(0, 180) || "documento";
export async function ownerDocumentsRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] };
  const handle =
    (fn: (r: any, p: any) => Promise<any>) => async (r: any, p: any) => {
      try {
        p.header("Cache-Control", "private, no-store");
        return await fn(r, p);
      } catch (e: any) {
        if (e instanceof z.ZodError)
          return p
            .code(400)
            .send({ error: e.issues.map((i) => i.message).join(" ") });
        const status = e.statusCode || (e.code === "ENOENT" ? 404 : 500);
        if (status >= 500)
          r.log.error({ code: e.code }, "Falha no armazenamento documental");
        return p
          .code(status)
          .send({
            error:
              status >= 500
                ? "Não foi possível acessar os documentos. Confira o armazenamento da API."
                : e.code === "FST_REQ_FILE_TOO_LARGE"
                  ? "O arquivo excede 10 MB."
                  : e.code === "ENOENT"
                    ? "Arquivo indisponível no armazenamento. Contate a cooperativa."
                    : e.message,
          });
      }
    };
  app.get(
    "/owner-documents",
    auth,
    handle(async (r) => {
      const coop = await scope(r),
        q = querySchema.parse(r.query);
      await owner(coop, q.kind, q.ownerId);
      const rows = await prisma.ownerDocument.findMany({
        where: { cooperativeId: coop, [`${q.kind}Id`]: q.ownerId },
        orderBy: { createdAt: "desc" },
      });
      const documents: any[] = rows.map(({ storageKey, ...d }) => ({
        ...d,
        source: "owner",
        download: `/owner-documents/owner/${d.id}/file`,
      }));
      if (q.kind === "collector") {
        const old = await prisma.collectorDocument.findMany({
          where: { collectorId: q.ownerId, collector: { cooperativeId: coop } },
        });
        documents.push(
          ...old.map((d) => ({
            id: d.id,
            source: "collector",
            title: d.documentName || d.documentType || "Documento do catador",
            documentType: d.documentType || "Outros",
            originalName: d.documentName || "Documento anexado",
            mimeType: d.fileMimeType,
            size: d.fileSize,
            notes: d.notes,
            createdAt: d.createdAt,
            download: `/owner-documents/collector/${d.id}/file`,
          })),
        );
      }
      if (q.kind === "vehicle") {
        const old = await prisma.vehicleDocument.findMany({
          where: { vehicleId: q.ownerId, cooperativeId: coop },
        });
        documents.push(
          ...old.map((d) => ({
            ...d,
            fileUrl: undefined,
            source: "vehicle",
            title: d.documentType,
            originalName: "Anexo do documento",
            download: d.fileUrl
              ? `/owner-documents/vehicle/${d.id}/file`
              : null,
          })),
        );
        const logs = await prisma.maintenanceLog.findMany({
          where: {
            vehicleId: q.ownerId,
            cooperativeId: coop,
            fileUrl: { not: null },
          },
        });
        documents.push(
          ...logs.map((d) => ({
            id: d.id,
            source: "maintenance",
            title: `Manutenção: ${d.maintenanceType}`,
            documentType: "Comprovante de manutenção",
            originalName: "Anexo da manutenção",
            createdAt: d.createdAt,
            notes: d.notes,
            download: `/owner-documents/maintenance/${d.id}/file`,
          })),
        );
      }
      return {
        documents: documents.sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
        ),
      };
    }),
  );
  app.post(
    "/owner-documents",
    auth,
    handle(async (r, p) => {
      const coop = await scope(r),
        fields: Record<string, string> = {};
      let buffer: Buffer | undefined;
      let originalName = "";
      for await (const part of r.parts({
        limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 12 },
      })) {
        if (part.type === "file") {
          if (part.fieldname !== "file" || !part.filename)
            fail("Selecione um arquivo.");
          buffer = await part.toBuffer();
          originalName = cleanName(part.filename);
          if (part.file.truncated) fail("O arquivo excede 10 MB.", 413);
        } else fields[part.fieldname] = String(part.value);
      }
      const data = metadata.parse(fields);
      await owner(coop, data.kind, data.ownerId);
      if (!buffer?.length) fail("Selecione um arquivo de até 10 MB.");
      const format = documentFormat(buffer!),
        storageKey = `${randomUUID()}.${format.ext}`,
        dir = privateDocumentDir();
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const filename = path.join(dir, storageKey);
      await writeFile(filename, buffer!, { flag: "wx", mode: 0o600 });
      try {
        const d = await prisma.ownerDocument.create({
          data: {
            cooperativeId: coop,
            [`${data.kind}Id`]: data.ownerId,
            title: data.title,
            documentType: data.documentType,
            documentNumber: data.documentNumber,
            issueDate: data.issueDate
              ? new Date(`${data.issueDate}T12:00:00Z`)
              : null,
            expiryDate: data.expiryDate
              ? new Date(`${data.expiryDate}T12:00:00Z`)
              : null,
            notes: data.notes,
            originalName,
            storageKey,
            mimeType: format.mime,
            size: buffer!.length,
          },
        });
        return p.code(201).send({ document: { id: d.id, title: d.title } });
      } catch (e) {
        await unlink(filename).catch(() => {});
        throw e;
      }
    }),
  );
  app.get(
    "/owner-documents/:source/:id/file",
    auth,
    handle(async (r, p) => {
      const coop = await scope(r),
        { source, id } = z
          .object({
            source: z.enum(["owner", "collector", "vehicle", "maintenance"]),
            id: z.string().min(1),
          })
          .parse(r.params);
      let filename: string, name: string, mime: string;
      if (source === "owner") {
        const d = await prisma.ownerDocument.findFirst({
          where: { id, cooperativeId: coop },
        });
        if (!d) fail("Documento não encontrado.", 404);
        const root = await realpath(privateDocumentDir());
        filename = await realpath(
          path.join(root, path.basename(d!.storageKey)),
        );
        if (!filename.startsWith(root + path.sep))
          fail("Arquivo inválido.", 404);
        name = d!.originalName;
        mime = d!.mimeType;
      } else {
        const model =
          source === "collector"
            ? prisma.collectorDocument
            : source === "vehicle"
              ? prisma.vehicleDocument
              : prisma.maintenanceLog;
        const d = await (model as any).findFirst({
          where: {
            id,
            ...(source === "collector"
              ? { collector: { cooperativeId: coop } }
              : { cooperativeId: coop }),
          },
        });
        if (!d?.fileUrl) fail("Documento não encontrado.", 404);
        const folder =
            source === "collector"
              ? "collectors"
              : source === "vehicle"
                ? "vehicle-documents"
                : "maintenance-logs",
          isPrivate = d.fileUrl.startsWith(`/private-documents/${folder}/`),
          prefix = `${isPrivate ? "/private-documents" : "/uploads"}/${folder}/`;
        if (
          !d.fileUrl.startsWith(prefix) ||
          path.basename(d.fileUrl) !== d.fileUrl.slice(prefix.length)
        )
          fail("Caminho de arquivo inválido.", 404);
        const root = await realpath(
          isPrivate
            ? path.join(privateDocumentDir(), folder)
            : path.join(process.cwd(), "uploads", folder),
        );
        filename = await realpath(path.join(root, path.basename(d.fileUrl)));
        if (!filename.startsWith(root + path.sep))
          fail("Arquivo inválido.", 404);
        name = path.basename(filename);
        mime = "application/octet-stream";
      }
      const info = await stat(filename);
      if (!info.isFile()) fail("Arquivo indisponível.", 404);
      p.type(mime)
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Length", String(info.size))
        .header(
          "Content-Disposition",
          `attachment; filename="documento${path.extname(filename).replace(/[^.a-zA-Z0-9]/g, "")}"; filename*=UTF-8''${encodeURIComponent(cleanName(name)).replace(/'/g, "%27")}`,
        );
      return p.send(createReadStream(filename));
    }),
  );
}
export async function parseLegacyDocument(
  request: any,
  folder: "vehicle-documents" | "maintenance-logs",
) {
  await scope(request);
  const body: Record<string, any> = {};
  let buffer: Buffer | undefined;
  for await (const part of request.parts({
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 40 },
  })) {
    if (part.type === "file") {
      if (!part.filename) {
        part.file.resume();
        continue;
      }
      if (part.fieldname !== "file") fail("Campo de arquivo inválido.");
      buffer = await part.toBuffer();
      if (part.file.truncated) fail("O arquivo excede 10 MB.", 413);
    } else body[part.fieldname] = part.value;
  }
  if (!buffer) return { body, fileUrl: null };
  if (!buffer.length) fail("O arquivo está vazio.");
  const format = documentFormat(buffer),
    dir = path.join(privateDocumentDir(), folder),
    filename = `${randomUUID()}.${format.ext}`;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(dir, filename), buffer, {
    flag: "wx",
    mode: 0o600,
  });
  return { body, fileUrl: `/private-documents/${folder}/${filename}` };
}
export async function cleanupLegacyDocument(url: string | null) {
  if (
    !url ||
    !/^\/private-documents\/(vehicle-documents|maintenance-logs)\/[a-f0-9-]+\.(pdf|jpg|png|webp)$/.test(
      url,
    )
  )
    return;
  const p = url.split("/");
  await unlink(path.join(privateDocumentDir(), p[2], p[3])).catch(() => {});
}
