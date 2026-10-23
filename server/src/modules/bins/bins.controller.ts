import type { FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  createBinSchema,
  updateBinSchema,
  binEventSchema,
  binPickupSchema,
} from "./bins.schemas";
import { binsService, BinError } from "./bins.service";
function identity(request: FastifyRequest) {
  const u = request.user as {
    sub?: string;
    id?: string;
    userId?: string;
    role?: string;
  };
  if (u?.role !== "COOPERATIVE")
    throw new BinError("Apenas a cooperativa pode gerenciar seus PEVs.", 403);
  const id = u.sub || u.id || u.userId;
  if (!id) throw new BinError("Usuário não autenticado.", 401);
  return id;
}
const paramsSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  eventId: z.string().min(1).max(100).optional(),
});
function action(
  fn: (
    userId: string,
    id: string,
    request: FastifyRequest,
    extra?: string,
  ) => Promise<unknown>,
  status = 200,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = identity(request);
      const p = paramsSchema.parse(request.params);
      return reply
        .status(status)
        .send({
          success: true,
          data: await fn(user, p.id || "", request, p.eventId),
        });
    } catch (error: any) {
      request.log.error({ error: error?.message }, "Operação de PEV rejeitada");
      if (error instanceof ZodError)
        return reply
          .status(400)
          .send({
            success: false,
            message: error.issues[0]?.message || "Revise os dados informados.",
            errors: error.flatten().fieldErrors,
          });
      if (error.code === "P2002")
        return reply
          .status(409)
          .send({
            success: false,
            message: "Este código de PEV já está cadastrado nesta cooperativa.",
          });
      return reply
        .status(error.statusCode || 500)
        .send({
          success: false,
          message:
            error instanceof BinError
              ? error.message
              : error.statusCode === 413
                ? "A foto deve ter até 5 MB."
                : "Não foi possível concluir a operação de PEV.",
        });
    }
  };
}
export const binsController = {
  list: action(async (user) => binsService.list(user)),
  findById: action((user, id) => binsService.findById(user, id)),
  create: action(
    (user, _id, req) =>
      binsService.create(user, createBinSchema.parse(req.body)),
    201,
  ),
  update: action((user, id, req) =>
    binsService.update(user, id, updateBinSchema.parse(req.body)),
  ),
  remove: action((user, id) => binsService.remove(user, id)),
  events: action((user, id, req) =>
    binsService.events(
      user,
      id,
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse((req.query as any)?.page || 1),
    ),
  ),
  event: action(
    (user, id, req) =>
      binsService.event(user, id, binEventSchema.parse(req.body)),
    201,
  ),
  resolve: action((user, id, _req, eventId) =>
    binsService.resolve(user, id, eventId!),
  ),
  withdrawals: action((user, id, req) =>
    binsService.withdrawals(
      user,
      id,
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100000)
        .parse((req.query as any)?.page || 1),
    ),
  ),
  pickup: action(
    (user, id, req) =>
      binsService.pickup(user, id, binPickupSchema.parse(req.body)),
    201,
  ),
  removePhoto: action((user, id) => binsService.photo(user, id, null)),
  photo: action(async (user, id, req) => {
    await binsService.findById(user, id);
    const file = await req.file({
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    });
    if (!file) throw new BinError("Selecione uma foto JPG, PNG ou WEBP.");
    const buffer = await file.toBuffer();
    const kind = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "png"
      : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
        ? "jpg"
        : buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : null;
    const mime = kind === "jpg" ? "image/jpeg" : `image/${kind}`;
    if (!kind || file.mimetype !== mime || file.fieldname !== "photo")
      throw new BinError("Arquivo inválido. Envie uma foto JPG, PNG ou WEBP.");
    const dir = path.join(process.cwd(), "uploads", "bins");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${kind}`,
      full = path.join(dir, name);
    await writeFile(full, buffer, { flag: "wx" });
    try {
      return await binsService.photo(user, id, `/uploads/bins/${name}`);
    } catch (error) {
      await unlink(full).catch(() => {});
      throw error;
    }
  }),
};
