import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, realpath } from "node:fs/promises";
import path from "node:path";
const limit = 3 * 1024 * 1024;
export const avatarDirectory = () =>
  path.resolve(
    process.env.PROFILE_STORAGE_DIR ||
      path.join(process.cwd(), "storage", "profiles"),
  );
const fail = (message: string): never => {
  throw Error(message);
};
export function avatarMime(buffer: Buffer) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { ext: "png", mime: "image/png" };
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return { ext: "jpg", mime: "image/jpeg" };
  if (
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  )
    return { ext: "webp", mime: "image/webp" };
  return fail("Envie uma imagem JPG, PNG ou WEBP válida.");
}
export async function profileInput(request: FastifyRequest) {
  let displayName = "";
  let image: Buffer | undefined;
  if (request.isMultipart()) {
    for await (const part of request.parts({
      limits: { fileSize: limit, files: 1, fields: 2, parts: 3 },
    })) {
      if (part.type === "file") {
        if (part.fieldname !== "profileImage")
          fail("Campo de imagem inválido.");
        image = await part.toBuffer();
        if (part.file.truncated || image.length > limit)
          fail("A imagem deve ter no máximo 3 MB.");
      } else if (part.fieldname === "displayName" || part.fieldname === "name")
        displayName = String(part.value || "").trim();
      else fail("Campo de perfil não permitido.");
    }
  } else {
    const body = request.body as
      | { displayName?: unknown; name?: unknown }
      | undefined;
    const value = body?.displayName ?? body?.name;
    displayName = typeof value === "string" ? value.trim() : "";
  }
  if (displayName.length < 3 || displayName.length > 150)
    fail("Informe um nome entre 3 e 150 caracteres.");
  let key: string | undefined;
  if (image) {
    if (!image.length) fail("A imagem está vazia.");
    const format = avatarMime(image);
    await mkdir(avatarDirectory(), { recursive: true, mode: 0o700 });
    key = `${randomUUID()}.${format.ext}`;
    await writeFile(path.join(avatarDirectory(), key), image, {
      mode: 0o600,
      flag: "wx",
    });
  }
  return { displayName, key };
}
export async function avatarPath(key: string) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
    throw Error("Imagem indisponível.");
  const root = await realpath(avatarDirectory());
  const file = await realpath(path.join(root, key));
  if (!file.startsWith(root + path.sep)) throw Error("Imagem indisponível.");
  return file;
}
export async function discardAvatar(key?: string | null) {
  if (key && /^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key))
    await unlink(path.join(avatarDirectory(), key)).catch(() => undefined);
}
