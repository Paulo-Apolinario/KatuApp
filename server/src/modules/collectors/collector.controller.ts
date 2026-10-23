import {
  createWriteStream,
  existsSync,
} from "node:fs";

import {
  mkdir,
  unlink,
} from "node:fs/promises";

import {
  extname,
  join,
  resolve,
} from "node:path";

import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";

import {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ZodError } from "zod";

import {
  collectorDocumentMetadataSchema,
  collectorDocumentParamsSchema,
  collectorIdParamsSchema,
  createCollectorSchema,
  updateCollectorStatusSchema,
} from "./collector.schemas";

import {
  CollectorDocumentCreateData,
  CollectorService,
} from "./collector.service";

const collectorService = new CollectorService();

type AuthenticatedUser = {
  sub: string;
  role: string;
};

type SavedFile = {
  absolutePath: string;
  publicUrl: string;
  originalName: string;
  mimeType: string;
  size: number;
  fieldName: string;
};

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const ALLOWED_DOCUMENT_MIME_TYPES =
  new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function normalizeRole(role?: string) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function isCooperativeUser(
  user: AuthenticatedUser
) {
  return (
    normalizeRole(user.role) ===
    "COOPERATIVE"
  );
}

function getUploadsDirectory() {
  return resolve(
    process.cwd(),
    "uploads",
    "collectors"
  );
}

async function ensureUploadsDirectory() {
  const uploadsDirectory =
    getUploadsDirectory();

  if (!existsSync(uploadsDirectory)) {
    await mkdir(uploadsDirectory, {
      recursive: true,
    });
  }

  return uploadsDirectory;
}

function sanitizeFileName(
  fileName: string
) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getSafeExtension(
  fileName: string,
  mimeType: string
) {
  const originalExtension =
    extname(fileName).toLowerCase();

  if (originalExtension) {
    return originalExtension;
  }

  switch (mimeType) {
    case "application/pdf":
      return ".pdf";

    case "image/jpeg":
      return ".jpg";

    case "image/png":
      return ".png";

    case "image/webp":
      return ".webp";

    default:
      return "";
  }
}

function getMultipartFieldValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return "";
}

function getErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof ZodError) {
    return (
      error.issues[0]?.message ||
      fallbackMessage
    );
  }

  if (error instanceof Error) {
    return (
      error.message ||
      fallbackMessage
    );
  }

  return fallbackMessage;
}

function getValidationErrors(
  error: unknown
) {
  if (!(error instanceof ZodError)) {
    return undefined;
  }

  return error.flatten().fieldErrors;
}

function resolveDocumentType(
  originalName: string,
  declaredType?: string
) {
  if (declaredType?.trim()) {
    return declaredType
      .trim()
      .toUpperCase();
  }

  const normalizedFileName =
    originalName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  if (
    normalizedFileName.includes("cpf")
  ) {
    return "CPF";
  }

  if (
    normalizedFileName.includes("rg")
  ) {
    return "RG";
  }

  if (
    normalizedFileName.includes(
      "residencia"
    ) ||
    normalizedFileName.includes(
      "endereco"
    ) ||
    normalizedFileName.includes(
      "comprovante"
    )
  ) {
    return "COMPROVANTE_RESIDENCIA";
  }

  if (
    normalizedFileName.includes(
      "associacao"
    ) ||
    normalizedFileName.includes(
      "associado"
    )
  ) {
    return "TERMO_ASSOCIACAO";
  }

  return "OUTRO";
}

async function removeSavedFiles(
  files: SavedFile[]
) {
  await Promise.allSettled(
    files.map(async (file) => {
      try {
        await unlink(file.absolutePath);
      } catch (error: any) {
        if (error?.code !== "ENOENT") {
          console.error(
            "Erro ao remover arquivo:",
            file.absolutePath,
            error
          );
        }
      }
    })
  );
}

async function removePhysicalDocument(
  fileUrl?: string | null
) {
  if (
    !fileUrl ||
    !fileUrl.startsWith(
      "/uploads/collectors/"
    )
  ) {
    return;
  }

  const storedFileName =
    fileUrl.replace(
      "/uploads/collectors/",
      ""
    );

  if (
    !storedFileName ||
    storedFileName.includes("..")
  ) {
    return;
  }

  const absolutePath = join(
    getUploadsDirectory(),
    storedFileName
  );

  try {
    await unlink(absolutePath);
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error(
        "Não foi possível remover o documento físico:",
        error
      );
    }
  }
}

async function saveMultipartFile(
  part: any
): Promise<SavedFile> {
  const originalName = String(
    part.filename || "documento"
  );

  const mimeType = String(
    part.mimetype ||
      "application/octet-stream"
  );

  if (
    !ALLOWED_DOCUMENT_MIME_TYPES.has(
      mimeType
    )
  ) {
    part.file.resume();

    throw new Error(
      `Formato do arquivo "${originalName}" não permitido. ` +
        "Utilize PDF, JPG, PNG ou WEBP."
    );
  }

  const uploadsDirectory =
    await ensureUploadsDirectory();

  const originalExtension =
    extname(originalName);

  const extension = getSafeExtension(
    originalName,
    mimeType
  );

  const baseName =
    sanitizeFileName(
      originalName.replace(
        originalExtension,
        ""
      )
    ) || "documento";

  const storedFileName =
    `${Date.now()}-${randomUUID()}-${baseName}${extension}`;

  const absolutePath = join(
    uploadsDirectory,
    storedFileName
  );

  const publicUrl =
    `/uploads/collectors/${storedFileName}`;

  let receivedBytes = 0;

  part.file.on(
    "data",
    (chunk: Buffer) => {
      receivedBytes += chunk.length;

      if (
        receivedBytes >
        MAX_FILE_SIZE
      ) {
        part.file.destroy(
          new Error(
            `O arquivo "${originalName}" ultrapassa o limite de 10 MB.`
          )
        );
      }
    }
  );

  try {
    await pipeline(
      part.file,
      createWriteStream(
        absolutePath,
        {
          flags: "wx",
        }
      )
    );
  } catch (error) {
    try {
      await unlink(absolutePath);
    } catch {
      // O arquivo pode não ter sido criado.
    }

    throw error;
  }

  if (part.file.truncated) {
    try {
      await unlink(absolutePath);
    } catch {
      // Evita mascarar o erro principal.
    }

    throw new Error(
      `O arquivo "${originalName}" ultrapassa o limite permitido.`
    );
  }

  return {
    absolutePath,
    publicUrl,
    originalName,
    mimeType,
    size: receivedBytes,
    fieldName: String(
      part.fieldname || ""
    ),
  };
}

async function readMultipartCollectorRequest(
  request: FastifyRequest
) {
  const fields: Record<
    string,
    string
  > = {};

  const savedFiles: SavedFile[] = [];

  for await (
    const part of request.parts()
  ) {
    if (part.type === "file") {
      const fieldName = String(
        part.fieldname || ""
      );

      const isDocumentField =
        fieldName === "document" ||
        fieldName === "documents" ||
        fieldName.startsWith(
          "documents["
        );

      if (!isDocumentField) {
        part.file.resume();
        continue;
      }

      const savedFile =
        await saveMultipartFile(part);

      savedFiles.push(savedFile);

      continue;
    }

    const fieldName = String(
      part.fieldname || ""
    );

    fields[fieldName] =
      getMultipartFieldValue(
        part.value
      );
  }

  const documentMetadata =
    collectorDocumentMetadataSchema.parse({
      documentType:
        fields.documentType,
      documentName:
        fields.documentName,
      notes:
        fields.documentNotes ||
        fields.notes,
    });

  const documents:
    CollectorDocumentCreateData[] =
      savedFiles.map((file) => ({
        documentType:
          resolveDocumentType(
            file.originalName,
            documentMetadata.documentType
          ),

        documentName:
          documentMetadata.documentName ||
          file.originalName,

        fileUrl: file.publicUrl,

        fileMimeType:
          file.mimeType,

        fileSize: file.size,

        notes:
          documentMetadata.notes ||
          null,
      }));

  delete fields.documentType;
  delete fields.documentName;
  delete fields.documentNotes;

  return {
    fields,
    documents,
    savedFiles,
  };
}

export class CollectorController {
  async create(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const savedFiles: SavedFile[] = [];

    try {
      const authUser =
        request.user as AuthenticatedUser;

      if (
        !isCooperativeUser(authUser)
      ) {
        return reply
          .status(403)
          .send({
            success: false,
            error:
              "Apenas cooperativas podem cadastrar catadores.",
          });
      }

      let rawBody: unknown;
      let uploadedDocuments:
        CollectorDocumentCreateData[] =
          [];

      if (request.isMultipart()) {
        const multipartData =
          await readMultipartCollectorRequest(
            request
          );

        rawBody =
          multipartData.fields;

        uploadedDocuments =
          multipartData.documents;

        savedFiles.push(
          ...multipartData.savedFiles
        );
      } else {
        rawBody =
          request.body;
      }

      const body =
        createCollectorSchema.parse(
          rawBody
        );

      const collector =
        await collectorService.create(
          authUser.sub,
          body,
          uploadedDocuments
        );

      return reply
        .status(201)
        .send({
          success: true,
          message:
            "Cadastro efetuado com sucesso.",
          collector,
        });
    } catch (error: unknown) {
      await removeSavedFiles(
        savedFiles
      );

      console.error(
        "Erro ao criar catador:",
        error
      );

      return reply
        .status(400)
        .send({
          success: false,

          error: getErrorMessage(
            error,
            "Erro ao criar catador."
          ),

          errors:
            getValidationErrors(
              error
            ),
        });
    }
  }

  async listMine(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        request.user as AuthenticatedUser;

      if (
        !isCooperativeUser(authUser)
      ) {
        return reply
          .status(403)
          .send({
            success: false,
            error:
              "Apenas cooperativas podem listar catadores.",
          });
      }

      const collectors =
        await collectorService
          .listByAuthenticatedCooperative(
            authUser.sub
          );

      return reply.send({
        success: true,
        collectors,
      });
    } catch (error: unknown) {
      console.error(
        "Erro ao listar catadores:",
        error
      );

      return reply
        .status(400)
        .send({
          success: false,
          error: getErrorMessage(
            error,
            "Erro ao listar catadores."
          ),
        });
    }
  }

  async findById(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        request.user as AuthenticatedUser;

      if (
        !isCooperativeUser(authUser)
      ) {
        return reply
          .status(403)
          .send({
            success: false,
            error:
              "Apenas cooperativas podem consultar catadores.",
          });
      }

      const params =
        collectorIdParamsSchema.parse(
          request.params
        );

      const collector =
        await collectorService.findById(
          authUser.sub,
          params.id
        );

      return reply.send({
        success: true,
        collector,
      });
    } catch (error: unknown) {
      console.error(
        "Erro ao buscar catador:",
        error
      );

      const message =
        getErrorMessage(
          error,
          "Erro ao buscar catador."
        );

      const statusCode =
        message ===
        "Catador não encontrado."
          ? 404
          : 400;

      return reply
        .status(statusCode)
        .send({
          success: false,
          error: message,
          errors:
            getValidationErrors(
              error
            ),
        });
    }
  }

  async updateStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        request.user as AuthenticatedUser;

      if (
        !isCooperativeUser(authUser)
      ) {
        return reply
          .status(403)
          .send({
            success: false,
            error:
              "Apenas cooperativas podem atualizar o status dos catadores.",
          });
      }

      const params =
        collectorIdParamsSchema.parse(
          request.params
        );

      const body =
        updateCollectorStatusSchema.parse(
          request.body
        );

      const collector =
        await collectorService.updateStatus(
          authUser.sub,
          params.id,
          body.status
        );

      return reply.send({
        success: true,
        message:
          "Status do catador atualizado com sucesso.",
        collector,
      });
    } catch (error: unknown) {
      console.error(
        "Erro ao atualizar status do catador:",
        error
      );

      return reply
        .status(400)
        .send({
          success: false,

          error: getErrorMessage(
            error,
            "Erro ao atualizar status do catador."
          ),

          errors:
            getValidationErrors(
              error
            ),
        });
    }
  }

  async addDocument(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const savedFiles: SavedFile[] = [];

    try {
      const authUser =
        request.user as AuthenticatedUser;

      if (
        !isCooperativeUser(authUser)
      ) {
        return reply
          .status(403)
          .send({
            success: false,
            error:
              "Apenas cooperativas podem anexar documentos aos catadores.",
          });
      }

      const params =
        collectorIdParamsSchema.parse(
          request.params
        );

      if (
        !request.isMultipart()
      ) {
        return reply
          .status(415)
          .send({
            success: false,
            error:
              "O documento deve ser enviado como multipart/form-data.",
          });
      }

      const fields: Record<
        string,
        string
      > = {};

      let uploadedFile:
        SavedFile | null = null;

      for await (
        const part of request.parts()
      ) {
        if (
          part.type === "file"
        ) {
          const fieldName =
            String(
              part.fieldname || ""
            );

          const isDocumentField =
            fieldName ===
              "document" ||
            fieldName ===
              "documents";

          if (
            !isDocumentField ||
            uploadedFile
          ) {
            part.file.resume();
            continue;
          }

          uploadedFile =
            await saveMultipartFile(
              part
            );

          savedFiles.push(
            uploadedFile
          );

          continue;
        }

        fields[
          String(
            part.fieldname || ""
          )
        ] =
          getMultipartFieldValue(
            part.value
          );
      }

      if (!uploadedFile) {
        return reply
          .status(400)
          .send({
            success: false,
            error:
              "Selecione um documento para enviar.",
          });
      }

      const metadata =
        collectorDocumentMetadataSchema.parse(
          {
            documentType:
              fields.documentType,

            documentName:
              fields.documentName,

            notes:
              fields.notes ||
              fields.documentNotes,
          }
        );

      const document =
        await collectorService.addDocument(
          authUser.sub,
          params.id,
          {
            documentType:
              resolveDocumentType(
                uploadedFile.originalName,
                metadata.documentType
              ),

            documentName:
              metadata.documentName ||
              uploadedFile.originalName,

            fileUrl:
              uploadedFile.publicUrl,

            fileMimeType:
              uploadedFile.mimeType,

            fileSize:
              uploadedFile.size,

            notes:
              metadata.notes ||
              null,
          }
        );

      return reply
        .status(201)
        .send({
          success: true,
          message:
            "Documento anexado com sucesso.",
          document,
        });
    } catch (error: unknown) {
      await removeSavedFiles(
        savedFiles
      );

      console.error(
        "Erro ao anexar documento do catador:",
        error
      );

      return reply
        .status(400)
        .send({
          success: false,

          error: getErrorMessage(
            error,
            "Erro ao anexar documento do catador."
          ),

          errors:
            getValidationErrors(
              error
            ),
        });
    }
  }

  async listDocuments(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        request.user as AuthenticatedUser;

      if (
        !isCooperativeUser(authUser)
      ) {
        return reply
          .status(403)
          .send({
            success: false,
            error:
              "Apenas cooperativas podem consultar documentos dos catadores.",
          });
      }

      const params =
        collectorIdParamsSchema.parse(
          request.params
        );

      const documents =
        await collectorService.listDocuments(
          authUser.sub,
          params.id
        );

      return reply.send({
        success: true,
        documents,
      });
    } catch (error: unknown) {
      console.error(
        "Erro ao listar documentos do catador:",
        error
      );

      const message =
        getErrorMessage(
          error,
          "Erro ao listar documentos do catador."
        );

      const statusCode =
        message ===
        "Catador não encontrado."
          ? 404
          : 400;

      return reply
        .status(statusCode)
        .send({
          success: false,
          error: message,
          errors:
            getValidationErrors(
              error
            ),
        });
    }
  }

  async deleteDocument(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const authUser =
        request.user as AuthenticatedUser;

      if (
        !isCooperativeUser(authUser)
      ) {
        return reply
          .status(403)
          .send({
            success: false,
            error:
              "Apenas cooperativas podem excluir documentos dos catadores.",
          });
      }

      const params =
        collectorDocumentParamsSchema.parse(
          request.params
        );

      const document =
        await collectorService.deleteDocument(
          authUser.sub,
          params.id,
          params.documentId
        );

      await removePhysicalDocument(
        document.fileUrl
      );

      return reply.send({
        success: true,
        message:
          "Documento excluído com sucesso.",
      });
    } catch (error: unknown) {
      console.error(
        "Erro ao excluir documento do catador:",
        error
      );

      const message =
        getErrorMessage(
          error,
          "Erro ao excluir documento do catador."
        );

      const notFoundErrors = [
        "Catador não encontrado.",
        "Documento do catador não encontrado.",
      ];

      const statusCode =
        notFoundErrors.includes(
          message
        )
          ? 404
          : 400;

      return reply
        .status(statusCode)
        .send({
          success: false,
          error: message,
          errors:
            getValidationErrors(
              error
            ),
        });
    }
  }
}